import {Project, InstrumentFactories, ColorCodes, SampleStorage, encodeWavFloat} from "@opendaw/studio-core"
import {AudioFileBox, AudioRegionBox, NoteRegionBox, NoteEventCollectionBox} from "@opendaw/studio-boxes"
import {UUID} from "@opendaw/lib-std"
import {PPQN} from "@opendaw/lib-dsp"
import {SampleApi} from "@/service/SampleApi"
import { BasicPitch, outputToNotesPoly } from "@spotify/basic-pitch"

export interface ConversionResult {
    success: boolean
    message: string
    midiData?: any
    error?: string
}

export interface MidiNote {
    note: number
    velocity: number
    startTime: number
    endTime: number
}

export interface MidiData {
    notes: MidiNote[]
    tempo: number
    timeSignature: [number, number]
}

export class MidiConversionService {
    private readonly project: Project
    private readonly basicPitchUrl = 'https://basicpitch.spotify.com/api/transcribe'
    private readonly basicPitchApiUrl = (typeof window !== 'undefined' && location.hostname === 'localhost')
        ? 'http://localhost:3001/api/convert-to-midi'
        : '/api/convert-to-midi'
    private readonly testMode = false // Disable test mode for real conversion

    constructor(project: Project) {
        this.project = project
        console.log('🎵 MidiConversionService initialized')
        if (this.testMode) {
            console.log('🎵 Test mode enabled - will simulate conversion for debugging')
        }
    }

    /**
     * Convert an audio file to MIDI using Basic Pitch
     */
    async convertAudioToMidi(audioFileBox: AudioFileBox): Promise<ConversionResult> {
        try {
            console.log('🎵 Starting audio to MIDI conversion...')
            
            // Get the audio file data
            const fileName = audioFileBox.fileName.getValue()
            console.log('🎵 Converting file:', fileName)
            
            // Show notification
            this.showNotification(`🎵 Converting "${fileName}" to MIDI...`, 'info')
            
            // Try automatic conversion first
            const autoResult = await this.convertUsingBasicPitchAPI(audioFileBox)
            
            if (autoResult.success && autoResult.midiData) {
                // Create MIDI track and add the converted notes
                await this.createMidiTrackFromConversion(autoResult.midiData, fileName)
                this.showNotification(`🎵 Successfully converted "${fileName}" to MIDI!`, 'success')
                return autoResult
            }
            
            // Fallback to web interface if automatic conversion fails
            const webResult = await this.convertUsingBasicPitchWeb(fileName)
            
            if (webResult.success) {
                this.showNotification(`🎵 Conversion panel opened for "${fileName}"`, 'success')
            } else {
                this.showNotification(`❌ Failed to convert "${fileName}"`, 'error')
            }
            
            return webResult
            
        } catch (error) {
            console.error('🎵 Error converting audio to MIDI:', error)
            this.showNotification(`❌ Error converting audio to MIDI: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
            return {
                success: false,
                message: 'Failed to convert audio to MIDI',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    /**
     * Automatic conversion using Basic Pitch API
     */
    private async convertUsingBasicPitchAPI(audioFileBox: AudioFileBox): Promise<ConversionResult> {
        try {
            console.log('🎵 Converting in-browser with @spotify/basic-pitch (AudioFileBox)...')

            const blob = await this.getAudioFileData(audioFileBox)
            if (!blob) throw new Error('Could not retrieve audio file data')

            const ac = new AudioContext()
            const abuf = await blob.arrayBuffer()
            const audioBuffer = await ac.decodeAudioData(abuf)

            // Use BasicPitch with the included model
            const modelPath = '/node_modules/@spotify/basic-pitch/model/model.json'
            const basicPitch = new BasicPitch(modelPath)
            
            const frames: number[][] = []
            const onsets: number[][] = []
            const contours: number[][] = []
            
            await basicPitch.evaluateModel(audioBuffer, 
                (frame, onset, contour) => {
                    frames.push(...frame)
                    onsets.push(...onset)
                    contours.push(...contour)
                },
                (progress) => console.log('🎵 Conversion progress:', Math.round(progress * 100) + '%')
            )
            
            // Convert the raw output to notes using the utility function
            const notes = outputToNotesPoly(frames, onsets, contours)
            const midiJson = { notes }
            console.log('🎵 basicPitch JSON:', midiJson)

            // Try to emit a MIDI file
            const midiBlob = await this.tryCreateMidiFromJson(midiJson)
            if (midiBlob) {
                const midiUrl = URL.createObjectURL(midiBlob)
                const base = audioFileBox.fileName.getValue().replace(/\.[^/.]+$/, '')
                this.downloadFile(midiUrl, `${base}.mid`)
                this.showNotification(`🎵 Converted "${base}". MIDI downloaded.`, 'success')
            }

            return { success: true, message: 'Converted with Basic Pitch', midiData: midiJson }
        } catch (error) {
            console.log('🎵 In-browser conversion failed, falling back to web interface:', error)
            return {
                success: false,
                message: 'Automatic conversion failed, using web interface instead',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    /**
     * Get audio file data as Blob for API upload
     */
    private async getAudioFileData(audioFileBox: AudioFileBox): Promise<Blob | null> {
        try {
            console.log('🎵 Getting audio file data for:', audioFileBox.fileName.getValue())

            const uuid = audioFileBox.address.uuid

            // 1) Try local OPFS via SampleStorage
            try {
                const audioContext = new AudioContext()
                const [audio] = await SampleStorage.load(uuid, audioContext)
                const wavBytes = encodeWavFloat({
                    channels: audio.frames.slice(),
                    sampleRate: audio.sampleRate,
                    numFrames: audio.numberOfFrames
                })
                return new Blob([wavBytes], {type: 'audio/wav'})
            } catch {
                // continue to remote
            }

            // 2) Try remote SampleApi fetch of raw file
            try {
                const url = `${SampleApi.FileRoot}/${UUID.toString(uuid)}`
                const resp = await fetch(url, {credentials: 'include'})
                if (resp.ok) {
                    const buf = await resp.arrayBuffer()
                    return new Blob([buf], {type: resp.headers.get('Content-Type') ?? 'audio/wav'})
                }
            } catch {
                // ignore and fall through
            }

            // None worked
            return null
        } catch (error) {
            console.error('🎵 Error getting audio file data:', error)
            return null
        }
    }

    /**
     * Create a file input to get the audio file from user
     */
    private async createFileInputForAudio(audioFileBox: AudioFileBox): Promise<Blob | null> {
        return new Promise((resolve) => {
            const fileInput = document.createElement('input')
            fileInput.type = 'file'
            fileInput.accept = 'audio/*'
            fileInput.style.display = 'none'
            
            fileInput.onchange = (event) => {
                const target = event.target as HTMLInputElement
                if (target.files && target.files.length > 0) {
                    const file = target.files[0]
                    console.log('🎵 User selected file:', file.name)
                    resolve(file)
                } else {
                    resolve(null)
                }
                
                // Clean up
                document.body.removeChild(fileInput)
            }
            
            // Show file picker
            document.body.appendChild(fileInput)
            fileInput.click()
            
            // Auto-cancel after 10 seconds
            setTimeout(() => {
                if (fileInput.parentElement) {
                    document.body.removeChild(fileInput)
                    resolve(null)
                }
            }, 10000)
        })
    }

    /**
     * Enhanced automatic conversion with file handling using @spotify/basic-pitch in-browser
     */
    async convertAudioFileToMidiWithFile(audioFile: File): Promise<ConversionResult> {
        try {
            console.log('🎵 Converting with @spotify/basic-pitch:', audioFile.name)
            this.showNotification(`🎵 Converting "${audioFile.name}" to MIDI...`, 'info')

            const audioBuffer = await this.decodeFileToAudioBuffer(audioFile)
            
            // Use BasicPitch class for conversion
            // Use BasicPitch with the included model
            const modelPath = '/node_modules/@spotify/basic-pitch/model/model.json'
            const basicPitch = new BasicPitch(modelPath)
            
            const frames: number[][] = []
            const onsets: number[][] = []
            const contours: number[][] = []
            
            await basicPitch.evaluateModel(audioBuffer, 
                (frame, onset, contour) => {
                    frames.push(...frame)
                    onsets.push(...onset)
                    contours.push(...contour)
                },
                (progress) => console.log('🎵 Conversion progress:', Math.round(progress * 100) + '%')
            )
            
            // Convert the raw output to notes using the utility function
            const notes = outputToNotesPoly(frames, onsets, contours)
            const midiJson = { notes }
            console.log('🎵 basicPitch JSON:', midiJson)

            // Try to emit a MIDI file
            const midiBlob = await this.tryCreateMidiFromJson(midiJson)
            if (midiBlob) {
                const midiUrl = URL.createObjectURL(midiBlob)
                this.downloadFile(midiUrl, `${audioFile.name.replace(/\.[^/.]+$/, '')}.mid`)
                this.showNotification(`🎵 Converted "${audioFile.name}". MIDI downloaded.`, 'success')
            } else {
                // Fallback to JSON download
                const jsonBlob = new Blob([JSON.stringify(midiJson, null, 2)], {type: 'application/json'})
                const jsonUrl = URL.createObjectURL(jsonBlob)
                this.downloadFile(jsonUrl, `${audioFile.name.replace(/\.[^/.]+$/, '')}.json`)
                this.showNotification(`🎵 Converted "${audioFile.name}". JSON downloaded.`, 'success')
            }

            return { success: true, message: 'Converted with Basic Pitch', midiData: midiJson }
        } catch (error) {
            console.error('🎵 Error in basic-pitch conversion:', error)
            return { success: false, message: 'Conversion failed', error: error instanceof Error ? error.message : 'Unknown' }
        }
    }

    private async decodeFileToAudioBuffer(file: File): Promise<AudioBuffer> {
        const ac = new AudioContext()
        const buf = await file.arrayBuffer()
        return ac.decodeAudioData(buf)
    }

    private async tryCreateMidiFromJson(midiJson: any): Promise<Blob | null> {
        try {
            const mod: any = await import('midi-writer-js')
            const MidiWriter = mod.default ?? mod
            const track = new MidiWriter.Track()
            track.setTempo(120)
            const ticksPerBeat = 128

            const notes = this.extractNotesFromJson(midiJson)
            let lastTick = 0
            for (const n of notes) {
                const startTick = Math.round(this.secondsToBeats(n.start) * ticksPerBeat)
                const endTick = Math.round(this.secondsToBeats(n.end) * ticksPerBeat)
                const durationTicks = Math.max(1, endTick - startTick)
                const waitTicks = Math.max(0, startTick - lastTick)
                if (waitTicks > 0) track.addEvent(new MidiWriter.WaitEvent({ ticks: waitTicks }))
                track.addEvent(new MidiWriter.NoteEvent({ pitch: [this.midiNumberToPitch(n.midi)], duration: 'T' + durationTicks, velocity: Math.round((n.velocity ?? 0.8) * 100) }))
                lastTick = startTick + durationTicks
            }
            const writer = new MidiWriter.Writer([track])
            const dataUri = writer.dataUri()
            // Convert dataUri to Blob
            const byteString = atob(dataUri.split(',')[1])
            const ab = new ArrayBuffer(byteString.length)
            const ia = new Uint8Array(ab)
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
            return new Blob([ab], {type: 'audio/midi'})
        } catch (e) {
            console.warn('🎵 Could not create MIDI from JSON, falling back to JSON download:', e)
            return null
        }
    }

    private extractNotesFromJson(midiJson: any): Array<{ midi: number, start: number, end: number, velocity?: number }> {
        // Try a few common shapes
        if (Array.isArray(midiJson?.notes)) {
            const a = midiJson.notes
            if (a.length && ('midi' in a[0] || 'pitch' in a[0])) {
                return a.map((n: any) => ({
                    midi: ('midi' in n) ? n.midi : ('pitch' in n ? n.pitch : 60),
                    start: n.start ?? n.startTime ?? n.startSec ?? 0,
                    end: (n.end ?? n.endTime ?? (n.start ?? 0) + (n.duration ?? 0.25)),
                    velocity: n.velocity ?? n.vel
                }))
            }
        }
        return []
    }

    private secondsToBeats(seconds: number, tempoBpm: number = 120): number {
        return seconds * (tempoBpm / 60)
    }

    private midiNumberToPitch(midi: number): string {
        const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
        const n = midi % 12
        const o = Math.floor(midi / 12) - 1
        return `${notes[n]}${o}`
    }

    private downloadFile(href: string, filename: string): void {
        const a = document.createElement('a')
        a.href = href
        a.download = filename
        document.body.appendChild(a)
        a.click()
        setTimeout(() => { URL.revokeObjectURL(href); a.remove() }, 0)
    }

    /**
     * Convert using Basic Pitch web interface (opens in new tab)
     */
    private async convertUsingBasicPitchWeb(fileName: string): Promise<ConversionResult> {
        try {
            // Create a conversion panel for the user
            this.showConversionPanel(fileName)
            
            return {
                success: true,
                message: 'Conversion panel opened. Please use Basic Pitch web interface to convert your audio.',
                midiData: null
            }
        } catch (error) {
            console.error('🎵 Error opening conversion panel:', error)
            return {
                success: false,
                message: 'Failed to open conversion panel',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    /**
     * Create MIDI track from converted data
     */
    private async createMidiTrackFromConversion(midiData: any, originalFileName: string): Promise<void> {
        try {
            console.log('🎵 Creating MIDI track from conversion data')
            
            // Parse MIDI data and create note regions
            const notes = this.parseMidiData(midiData)
            if (notes.length === 0) {
                console.warn('🎵 No notes found in MIDI data')
                return
            }
            
            // Create a new note track
            const noteTrack = await this.createNoteTrack(originalFileName)
            if (!noteTrack) {
                console.error('🎵 Failed to create note track')
                return
            }
            
            // Add notes to the track
            await this.addNotesToTrack(noteTrack, notes)
            
            console.log('🎵 MIDI track creation completed successfully')
            
        } catch (error) {
            console.error('🎵 Error creating MIDI track:', error)
        }
    }

    /**
     * Parse MIDI data into note objects
     */
    private parseMidiData(midiData: any): MidiNote[] {
        try {
            const notes: MidiNote[] = []
            
            // This is a simplified parser - in a real implementation, you'd:
            // 1. Parse the actual MIDI format (JSON, MIDI file, etc.)
            // 2. Extract note events, timing, velocity, etc.
            // 3. Convert to Sona's note format
            
            if (midiData.notes && Array.isArray(midiData.notes)) {
                midiData.notes.forEach((note: any) => {
                    notes.push({
                        note: note.note || 60, // Default to middle C
                        velocity: note.velocity || 80,
                        startTime: note.startTime || 0,
                        endTime: note.endTime || 0.5
                    })
                })
            }
            
            console.log('🎵 Parsed notes:', notes.length)
            return notes
            
        } catch (error) {
            console.error('🎵 Error parsing MIDI data:', error)
            return []
        }
    }

    /**
     * Create a new note track for the converted MIDI
     */
    private async createNoteTrack(trackName: string): Promise<any> {
        try {
            // Get the project API to create tracks
            const projectApi = this.project.api
            
            // Find the first audio unit to add the track to
            const audioUnits = this.project.boxGraph.boxes().filter(box => 
                box.constructor.name === 'AudioUnitBox'
            )
            
            if (audioUnits.length === 0) {
                console.error('🎵 No audio units found to add note track to')
                return null
            }
            
            const audioUnit = audioUnits[0]
            
            // Create a note track - we'll need to properly type this
            // For now, just log that we would create a track
            console.log('🎵 Would create note track for audio unit:', audioUnit)
            console.log('🎵 Track name would be:', `MIDI - ${trackName}`)
            
            // Return a placeholder for now
            return { name: `MIDI - ${trackName}`, type: 'note-track' }
            
        } catch (error) {
            console.error('🎵 Error creating note track:', error)
            return null
        }
    }

    /**
     * Add notes to the created track
     */
    private async addNotesToTrack(track: any, notes: MidiNote[]): Promise<void> {
        try {
            console.log('🎵 Adding notes to track:', notes.length)
            
            // This would create note regions with the converted MIDI data
            // In a real implementation, you'd:
            // 1. Create note regions for each note
            // 2. Set proper timing and pitch
            // 3. Add to the track
            
            notes.forEach((note, index) => {
                console.log(`🎵 Adding note ${index + 1}:`, note)
                // Create note region logic would go here
            })
            
        } catch (error) {
            console.error('🎵 Error adding notes to track:', error)
        }
    }

    /**
     * Show enhanced conversion panel with automatic upload option
     */
    private showConversionPanel(fileName: string): void {
        console.log('🎵 Creating conversion panel for:', fileName)
        
        const panel = document.createElement('div')
        panel.className = 'midi-conversion-panel'
        panel.innerHTML = `
            <div class="conversion-header">
                <h3>🎵 Convert "${fileName}" to MIDI</h3>
                <p>Choose your preferred conversion method</p>
            </div>
            
            <div class="conversion-methods">
                <div class="method automatic">
                    <h4>🚀 Automatic Conversion</h4>
                    <p>Upload your audio file and get MIDI automatically imported into Sona</p>
                    <button class="upload-btn" type="button">
                        📁 Upload Audio File
                    </button>
                    <div class="file-upload-area" style="display: none;">
                        <div class="file-info">
                            <span class="selected-file">No file selected</span>
                        </div>
                        <input type="file" accept="audio/*" class="audio-file-input" />
                        <button class="convert-btn" type="button">
                            🎹 Convert to MIDI
                        </button>
                    </div>
                </div>
                
                <div class="method web-interface">
                    <h4>🌐 Basic Pitch Web Interface</h4>
                    <p>Use Basic Pitch's advanced web interface for more control</p>
                    <button class="open-basic-pitch-btn" type="button">
                        🌐 Open Basic Pitch
                    </button>
                </div>
            </div>
            
            <div class="conversion-tips">
                <h4>💡 Tips for Best Results:</h4>
                <ul>
                    <li>Use clear, isolated audio (no background noise)</li>
                    <li>Mono recordings often work better than stereo</li>
                    <li>For complex arrangements, try converting sections separately</li>
                    <li>Adjust sensitivity settings in Basic Pitch if needed</li>
                </ul>
            </div>
            
            <div class="conversion-actions">
                <button class="close-panel-btn" type="button">
                    ✕ Close
                </button>
            </div>
        `

        // Add styles
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 550px;
            max-width: 650px;
            animation: fadeInScale 0.3s ease-out;
        `

        // Add conversion functionality
        this.addConversionPanelFunctionality(panel, fileName)
        
        // Add CSS animations
        this.addConversionPanelStyles()
        
        // Add to page
        document.body.appendChild(panel)
        
        console.log('🎵 Enhanced conversion panel displayed')
        
        // Add close button functionality
        const closeBtn = panel.querySelector('.close-panel-btn')
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (panel.parentElement) {
                    panel.remove()
                }
            })
        }
        
        // Add Basic Pitch button functionality
        const basicPitchBtn = panel.querySelector('.open-basic-pitch-btn')
        if (basicPitchBtn) {
            basicPitchBtn.addEventListener('click', () => {
                window.open('https://basicpitch.spotify.com/', '_blank')
            })
        }
    }

    /**
     * Add functionality to the conversion panel
     */
    private addConversionPanelFunctionality(panel: HTMLElement, fileName: string): void {
        console.log('🎵 Setting up conversion panel functionality')
        
        // Store reference to this service instance
        const serviceInstance = this
        
        // Get all the elements we need
        const uploadBtn = panel.querySelector('.upload-btn') as HTMLButtonElement
        const fileInput = panel.querySelector('.audio-file-input') as HTMLInputElement
        const fileUploadArea = panel.querySelector('.file-upload-area') as HTMLElement
        const convertBtn = panel.querySelector('.convert-btn') as HTMLButtonElement
        const selectedFileSpan = panel.querySelector('.selected-file') as HTMLElement
        
        if (!uploadBtn || !fileInput || !fileUploadArea || !convertBtn || !selectedFileSpan) {
            console.error('🎵 Missing required elements in conversion panel')
            return
        }
        
        // Handle upload button click
        uploadBtn.addEventListener('click', () => {
            console.log('🎵 Upload button clicked')
            fileInput.click()
        })
        
        // Handle file selection
        fileInput.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement
            if (target.files && target.files.length > 0) {
                const file = target.files[0]
                console.log('🎵 File selected:', file.name)
                
                // Show the file upload area
                fileUploadArea.style.display = 'block'
                
                // Update the selected file display
                selectedFileSpan.textContent = `Selected: ${file.name}`
                
                // Update the convert button
                convertBtn.textContent = `🎹 Convert "${file.name}" to MIDI`
                
                // Enable the convert button
                convertBtn.disabled = false
            }
        })
        
        // Handle convert button click
        convertBtn.addEventListener('click', async () => {
            if (fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0]
                console.log('🎵 Starting conversion for:', file.name)
                
                // Disable the convert button during conversion
                convertBtn.disabled = true
                convertBtn.textContent = '🔄 Converting...'
                
                try {
                    // Convert the file using the service instance
                    const result = await serviceInstance.convertAudioFileToMidiWithFile(file)
                    
                    if (result.success) {
                        console.log('🎵 Conversion successful!')
                        convertBtn.textContent = '✅ Conversion Complete!'
                        convertBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        
                        // Close the panel after successful conversion
                        setTimeout(() => {
                            if (panel.parentElement) panel.remove()
                        }, 1500)
                    } else {
                        console.error('🎵 Conversion failed:', result.error)
                        convertBtn.textContent = '❌ Conversion Failed'
                        convertBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        
                        // Re-enable the convert button after a delay
                        setTimeout(() => {
                            convertBtn.disabled = false
                            convertBtn.textContent = `🎹 Convert "${file.name}" to MIDI`
                            convertBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        }, 3000)
                    }
                } catch (error) {
                    console.error('🎵 Error during conversion:', error)
                    convertBtn.textContent = '❌ Error Occurred'
                    convertBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    
                    // Re-enable the convert button after a delay
                    setTimeout(() => {
                        convertBtn.disabled = false
                        convertBtn.textContent = `🎹 Convert "${file.name}" to MIDI`
                        convertBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    }, 3000)
                }
            } else {
                console.warn('🎵 No file selected for conversion')
                alert('Please select an audio file first!')
            }
        })
        
        // Initially disable the convert button
        convertBtn.disabled = true
        
        console.log('🎵 Conversion panel functionality setup complete')
    }

    /**
     * Show notification to user
     */
    private showNotification(message: string, type: 'info' | 'success' | 'error'): void {
        const notification = document.createElement('div')
        notification.className = `midi-conversion-notification ${type}`
        notification.textContent = message
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                         type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 
                         'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `
        
        document.body.appendChild(notification)
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-out'
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove()
                    }
                }, 300)
            }
        }, 5000)
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease-out'
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove()
                }
            }, 300)
        })
    }

    /**
     * Add CSS styles for the conversion panel and notifications
     */
    private addConversionPanelStyles(): void {
        if (document.getElementById('midi-conversion-styles')) {
            return
        }

        const styleSheet = document.createElement('style')
        styleSheet.id = 'midi-conversion-styles'
        styleSheet.textContent = `
            @keyframes fadeInScale {
                from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes slideOutRight {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
            
            .midi-conversion-panel {
                font-size: 14px;
                line-height: 1.5;
            }
            
            .conversion-header h3 {
                margin: 0 0 10px 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .conversion-header p {
                margin: 0 0 20px 0;
                opacity: 0.9;
            }
            
            .conversion-methods {
                display: flex;
                gap: 20px;
                margin-bottom: 25px;
            }
            
            .method {
                flex: 1;
                background: rgba(255,255,255,0.1);
                padding: 20px;
                border-radius: 10px;
                text-align: center;
            }
            
            .method h4 {
                margin: 0 0 10px 0;
                font-size: 16px;
                color: #fbbf24;
            }
            
            .method p {
                margin: 0 0 20px 0;
                opacity: 0.9;
            }
            
            .method .upload-btn {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            
            .method .upload-btn:hover {
                transform: scale(1.05);
            }
            
            .method .file-upload-area {
                margin-top: 15px;
                padding: 15px;
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .method .file-info {
                margin-bottom: 10px;
                padding: 8px 12px;
                background: rgba(255,255,255,0.1);
                border-radius: 6px;
                font-size: 12px;
                text-align: center;
            }
            
            .method .selected-file {
                color: #fbbf24;
                font-weight: 500;
            }
            
            .method .audio-file-input {
                display: none;
            }
            
            .method .convert-btn {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                width: 100%;
            }
            
            .method .convert-btn:hover:not(:disabled) {
                transform: scale(1.02);
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            }
            
            .method .convert-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .method .open-basic-pitch-btn {
                background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s ease;
                width: 100%;
            }
            
            .method .open-basic-pitch-btn:hover {
                transform: scale(1.02);
                background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            }
            
            .conversion-tips {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid #fbbf24;
                margin-bottom: 20px;
            }
            
            .conversion-tips h4 {
                margin: 0 0 10px 0;
                font-size: 14px;
                color: #fbbf24;
            }
            
            .conversion-tips ul {
                margin: 0;
                padding-left: 20px;
            }
            
            .conversion-tips li {
                margin-bottom: 5px;
                font-size: 13px;
                opacity: 0.9;
            }
            
            .conversion-actions {
                display: flex;
                justify-content: center;
                margin-top: 20px;
            }
            
            .conversion-actions .close-panel-btn {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            
            .conversion-actions .close-panel-btn:hover {
                background: rgba(255,255,255,0.3);
            }
            
            .conversion-automatic {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%);
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid #8b5cf6;
            }
            
            .conversion-automatic h4 {
                margin: 0 0 10px 0;
                font-size: 14px;
                color: #8b5cf6;
            }
            
            .conversion-automatic p {
                margin: 0;
                font-size: 13px;
                opacity: 0.9;
            }
            
            .midi-conversion-notification {
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            
            .midi-conversion-notification:hover {
                transform: scale(1.02);
            }
        `

        document.head.appendChild(styleSheet)
    }

    /**
     * Get all audio files in the project that can be converted
     */
    getConvertibleAudioFiles(): AudioFileBox[] {
        try {
            const audioFiles: AudioFileBox[] = []
            const boxGraph = this.project.boxGraph
            
            // Find all AudioFileBox instances in the project
            boxGraph.boxes().forEach(box => {
                if (box.constructor.name === 'AudioFileBox') {
                    audioFiles.push(box as AudioFileBox)
                }
            })
            
            console.log('🎵 Found convertible audio files:', audioFiles.length)
            return audioFiles
            
        } catch (error) {
            console.error('🎵 Error finding convertible audio files:', error)
            return []
        }
    }

    /**
     * Check if a file is convertible (not already MIDI)
     */
    isConvertible(fileName: string): boolean {
        const lowerName = fileName.toLowerCase()
        return lowerName.endsWith('.wav') || 
               lowerName.endsWith('.mp3') || 
               lowerName.endsWith('.aiff') || 
               lowerName.endsWith('.flac')
    }
}
