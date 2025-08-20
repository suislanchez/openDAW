import {Project, InstrumentFactories, ColorCodes} from "@opendaw/studio-core"
import {DelayDeviceBox, ReverbDeviceBox, AudioFileBox, AudioRegionBox} from "@opendaw/studio-boxes"
import {BoxAdapter} from "@opendaw/studio-adapters"
import {UUID} from "@opendaw/lib-std"
import {PPQN} from "@opendaw/lib-dsp"
import {SampleApi} from "./SampleApi"

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

export interface AudioEffectControl {
    type: 'reverb' | 'delay'
    parameters: Record<string, number>
    message: string
}

export interface TimelineControl {
    type: 'bpm' | 'signature'
    parameters: Record<string, number>
    message: string
}

export interface SampleControl {
    type: 'add_sample'
    parameters: Record<string, any>
    message: string
}

export class GroqService {
    private readonly apiKey: string
    private readonly baseUrl = 'https://api.groq.com/openai/v1/chat/completions'
    
    constructor(private project: Project) {
        // Get API key from environment variable or use a placeholder
        this.apiKey = import.meta.env.VITE_GROQ_API_KEY || 'your-api-key-here'
        
        // Debug: Log the project structure
        console.log('🎵 GroqService initialized with project:', this.project)
        console.log('🎵 Project keys:', Object.keys(this.project))
        
        if (this.project.timelineBoxAdapter) {
            console.log('🎵 TimelineBoxAdapter found:', this.project.timelineBoxAdapter)
            console.log('🎵 TimelineBoxAdapter keys:', Object.keys(this.project.timelineBoxAdapter))
            
            if (this.project.timelineBoxAdapter.box) {
                console.log('🎵 TimelineBox found:', this.project.timelineBoxAdapter.box)
                console.log('🎵 TimelineBox keys:', Object.keys(this.project.timelineBoxAdapter.box))
                
                if (this.project.timelineBoxAdapter.box.bpm) {
                    console.log('🎵 BPM field found:', this.project.timelineBoxAdapter.box.bpm)
                    console.log('🎵 Current BPM value:', this.project.timelineBoxAdapter.box.bpm.getValue())
                }
            }
        } else {
            console.error('🎵 No timelineBoxAdapter found in project')
        }
    }
    

    
    async sendMessage(message: string): Promise<string> {
        // Check if API key is properly configured
        if (this.apiKey === 'your-api-key-here' || !this.apiKey) {
            console.warn('🎵 Groq API key not configured. Please set VITE_GROQ_API_KEY environment variable.')
            return '⚠️ Groq API key not configured. Please set the VITE_GROQ_API_KEY environment variable in your .env file.'
        }
        
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama3-8b-8192',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an AI music production assistant for openDAW. You can help users with music production questions and control audio effects like reverb and delay, as well as timeline settings like BPM and time signature, and add samples to their projects.

When users ask to change reverb or delay settings, you should:
1. Understand what they want to change
2. Provide specific parameter values
3. Explain what each change does musically
4. Be helpful and educational

When users ask to change BPM or time signature, you should:
1. Understand the desired tempo or rhythm
2. Provide specific BPM values or time signature ratios
3. Explain the musical impact of the change
4. Be helpful and educational

When users ask to add samples, you should:
1. Understand what kind of sample they want
2. Explain that you'll add a smart-selected sample based on their preferences
3. Be encouraging and helpful
4. Suggest they can ask for specific types of samples

You can now understand requests like:
- "Add a drum sample" → Gets a drum/percussion sample
- "Add a slow sample" → Gets a sample with lower BPM
- "Add a fast sample" → Gets a sample with higher BPM
- "Add a bass sample" → Gets a bass/low frequency sample
- "Add a melodic sample" → Gets a melodic/musical sample
- "Add a dark sample" → Gets a moody/atmospheric sample
- "Add an electronic sample" → Gets a synth/digital sample

Available reverb parameters:
- decay: 0.0 to 1.0 (reverb tail length)
- preDelay: 0.0 to 1.0 (time before reverb starts)
- damp: 0.0 to 1.0 (high frequency damping)
- filter: 0.0 to 1.0 (low pass filter)
- wet: -60 to 0 dB (reverb signal level)
- dry: -60 to 0 dB (dry signal level)

Available delay parameters:
- delay: 0.0 to 1.0 (delay time)
- feedback: 0.0 to 1.0 (echo repetition)
- cross: 0.0 to 1.0 (stereo crossfeed)
- filter: 0.0 to 1.0 (low pass filter)
- wet: -60 to 0 dB (delay signal level)
- dry: -60 to 0 dB (dry signal level)

Available timeline parameters:
- BPM: 30 to 1000 (beats per minute)
- Time signature: 1/1 to 32/32 (beats per measure)

Keep responses concise but informative.`
                        },
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            })
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            
            const data = await response.json()
            return data.choices[0]?.message?.content || 'Sorry, I couldn\'t process your request.'
            
        } catch (error) {
            console.error('Error calling Groq API:', error)
            return 'Sorry, I\'m having trouble connecting right now. Please try again.'
        }
    }
    
    async processRequest(message: string): Promise<AudioEffectControl | TimelineControl | SampleControl | null> {
        const lowerMessage = message.toLowerCase()
        console.log('🎵 Processing request:', message)
        console.log('🎵 Lower message:', lowerMessage)
        
        // Check if API key is configured
        if (this.apiKey === 'your-api-key-here' || !this.apiKey) {
            console.warn('🎵 Cannot process request: Groq API key not configured')
            return null
        }
        
        // Check if this is a sample control request
        if (lowerMessage.includes('add') && (lowerMessage.includes('sample') || lowerMessage.includes('sound') || lowerMessage.includes('audio'))) {
            console.log('🎵 Detected sample control request')
            try {
                const aiResponse = await this.sendMessage(message)
                console.log('🎵 AI response:', aiResponse)
                
                // Create sample control
                const sampleControl = this.createSampleControl(aiResponse, lowerMessage)
                console.log('🎵 Created sample control:', sampleControl)
                
                if (sampleControl) {
                    // Apply the sample changes
                    await this.applySampleControl(sampleControl)
                }
                
                return sampleControl
            } catch (error) {
                console.error('🎵 Error processing sample request:', error)
                return null
            }
        }
        
        // Check if this is a timeline control request (BPM, time signature)
        if (lowerMessage.includes('bpm') || lowerMessage.includes('tempo') || 
            lowerMessage.includes('time signature') || lowerMessage.includes('signature') ||
            lowerMessage.includes('beats') || lowerMessage.includes('measure')) {
            console.log('🎵 Detected timeline control request')
            try {
                const aiResponse = await this.sendMessage(message)
                console.log('🎵 AI response:', aiResponse)
                
                // Parse the AI response to extract timeline parameter suggestions
                const timelineControl = this.parseTimelineParameters(aiResponse, lowerMessage)
                console.log('🎵 Parsed timeline control:', timelineControl)
                
                if (timelineControl) {
                    // Apply the timeline changes
                    await this.applyTimelineControl(timelineControl)
                }
                
                return timelineControl
            } catch (error) {
                console.error('🎵 Error processing timeline request:', error)
                return null
            }
        }
        
        // Check if this is a reverb or delay control request
        if (lowerMessage.includes('reverb') || lowerMessage.includes('delay')) {
            try {
                const aiResponse = await this.sendMessage(message)
                
                // Parse the AI response to extract parameter suggestions
                const effectControl = this.parseEffectParameters(aiResponse, lowerMessage)
                
                if (effectControl) {
                    // Apply the effect changes
                    await this.applyEffectControl(effectControl)
                }
                
                return effectControl
            } catch (error) {
                console.error('Error processing audio effect request:', error)
                return null
            }
        }
        
        return null
    }
    
    private parseTimelineParameters(aiResponse: string, userMessage: string): TimelineControl | null {
        const lowerResponse = aiResponse.toLowerCase()
        console.log('🎵 Parsing timeline parameters from AI response:', aiResponse)
        console.log('🎵 User message:', userMessage)
        
        // Check for BPM changes
        if (lowerResponse.includes('bpm') || lowerResponse.includes('tempo') || userMessage.includes('bpm') || userMessage.includes('tempo')) {
            console.log('🎵 Detected BPM change request')
            const bpmParams = this.extractBpmParameters(aiResponse)
            console.log('🎵 Extracted BPM parameters:', bpmParams)
            
            return {
                type: 'bpm',
                parameters: bpmParams,
                message: aiResponse
            }
        }
        
        // Check for time signature changes
        if (lowerResponse.includes('signature') || lowerResponse.includes('beats') || lowerResponse.includes('measure') || 
            userMessage.includes('signature') || userMessage.includes('beats') || userMessage.includes('measure')) {
            console.log('🎵 Detected time signature change request')
            return {
                type: 'signature',
                parameters: this.extractSignatureParameters(aiResponse),
                message: aiResponse
            }
        }
        
        console.log('🎵 No timeline parameters detected')
        return null
    }
    
    private parseEffectParameters(aiResponse: string, userMessage: string): AudioEffectControl | null {
        const lowerResponse = aiResponse.toLowerCase()
        
        // Simple parsing logic - in a real implementation, you might want more sophisticated parsing
        if (lowerResponse.includes('reverb') || userMessage.includes('reverb')) {
            return {
                type: 'reverb',
                parameters: this.extractReverbParameters(aiResponse),
                message: aiResponse
            }
        } else if (lowerResponse.includes('delay') || userMessage.includes('delay')) {
            return {
                type: 'delay',
                parameters: this.extractDelayParameters(aiResponse),
                message: aiResponse
            }
        }
        
        return null
    }
    
    private extractReverbParameters(response: string): Record<string, number> {
        const params: Record<string, number> = {}
        
        // Extract decay
        const decayMatch = response.match(/decay[:\s]+([0-9]*\.?[0-9]+)/i)
        if (decayMatch) params.decay = parseFloat(decayMatch[1])
        
        // Extract preDelay
        const preDelayMatch = response.match(/pre.?delay[:\s]+([0-9]*\.?[0-9]+)/i)
        if (preDelayMatch) params.preDelay = parseFloat(preDelayMatch[1])
        
        // Extract damp
        const dampMatch = response.match(/damp[:\s]+([0-9]*\.?[0-9]+)/i)
        if (dampMatch) params.damp = parseFloat(dampMatch[1])
        
        // Extract filter
        const filterMatch = response.match(/filter[:\s]+([0-9]*\.?[0-9]+)/i)
        if (filterMatch) params.filter = parseFloat(filterMatch[1])
        
        // Extract wet
        const wetMatch = response.match(/wet[:\s]+(-?[0-9]*\.?[0-9]+)/i)
        if (wetMatch) params.wet = parseFloat(wetMatch[1])
        
        // Extract dry
        const dryMatch = response.match(/dry[:\s]+(-?[0-9]*\.?[0-9]+)/i)
        if (dryMatch) params.dry = parseFloat(dryMatch[1])
        
        return params
    }
    
    private extractDelayParameters(response: string): Record<string, number> {
        const params: Record<string, number> = {}
        
        // Extract delay
        const delayMatch = response.match(/delay[:\s]+([0-9]*\.?[0-9]+)/i)
        if (delayMatch) params.delay = parseFloat(delayMatch[1])
        
        // Extract feedback
        const feedbackMatch = response.match(/feedback[:\s]+([0-9]*\.?[0-9]+)/i)
        if (feedbackMatch) params.feedback = parseFloat(feedbackMatch[1])
        
        // Extract cross
        const crossMatch = response.match(/cross[:\s]+([0-9]*\.?[0-9]+)/i)
        if (crossMatch) params.cross = parseFloat(crossMatch[1])
        
        // Extract filter
        const filterMatch = response.match(/filter[:\s]+([0-9]*\.?[0-9]+)/i)
        if (filterMatch) params.filter = parseFloat(filterMatch[1])
        
        // Extract wet
        const wetMatch = response.match(/wet[:\s]+(-?[0-9]*\.?[0-9]+)/i)
        if (wetMatch) params.wet = parseFloat(wetMatch[1])
        
        // Extract dry
        const dryMatch = response.match(/dry[:\s]+(-?[0-9]*\.?[0-9]+)/i)
        if (dryMatch) params.dry = parseFloat(dryMatch[1])
        
        return params
    }
    
    private extractBpmParameters(response: string): Record<string, number> {
        const params: Record<string, number> = {}
        
        console.log('🎵 Extracting BPM parameters from:', response)
        
        // Extract BPM - look for various patterns
        const bpmMatch = response.match(/(?:bpm|tempo)[:\s]+([0-9]+(?:\.[0-9]+)?)/i)
        if (bpmMatch) {
            params.bpm = parseFloat(bpmMatch[1])
            console.log('🎵 Found BPM from pattern 1:', params.bpm)
        }
        
        // Also look for just numbers that might be BPM
        const numberMatch = response.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:bpm|tempo)/i)
        if (numberMatch && !params.bpm) {
            params.bpm = parseFloat(numberMatch[1])
            console.log('🎵 Found BPM from pattern 2:', params.bpm)
        }
        
        // Look for standalone numbers that could be BPM (common BPM ranges)
        if (!params.bpm) {
            const standaloneMatch = response.match(/\b([0-9]{2,3})\b/g)
            if (standaloneMatch) {
                const potentialBpm = standaloneMatch
                    .map(n => parseInt(n))
                    .filter(n => n >= 30 && n <= 300) // Common BPM range
                    .sort((a, b) => Math.abs(a - 120) - Math.abs(b - 120)) // Closest to 120 BPM
                
                if (potentialBpm.length > 0) {
                    params.bpm = potentialBpm[0]
                    console.log('🎵 Found BPM from standalone number:', params.bpm)
                }
            }
        }
        
        console.log('🎵 Final BPM parameters:', params)
        return params
    }
    
    private extractSignatureParameters(response: string): Record<string, number> {
        const params: Record<string, number> = {}
        
        // Extract time signature patterns like "4/4", "3/4", etc.
        const signatureMatch = response.match(/([0-9]+)\/([0-9]+)/)
        if (signatureMatch) {
            params.nominator = parseInt(signatureMatch[1])
            params.denominator = parseInt(signatureMatch[2])
        }
        
        // Extract individual components
        const nominatorMatch = response.match(/(?:nominator|beats|top)[:\s]+([0-9]+)/i)
        if (nominatorMatch) params.nominator = parseInt(nominatorMatch[1])
        
        const denominatorMatch = response.match(/(?:denominator|measure|bottom)[:\s]+([0-9]+)/i)
        if (denominatorMatch) params.denominator = parseInt(denominatorMatch[1])
        
        return params
    }
    
    private createSampleControl(aiResponse: string, userMessage: string): SampleControl | null {
        console.log('🎵 Creating sample control from AI response:', aiResponse)
        
        // Parse user message to understand what type of sample they want
        const lowerMessage = userMessage.toLowerCase()
        const samplePreferences = this.parseSamplePreferences(lowerMessage)
        
        return {
            type: 'add_sample',
            parameters: {
                preferences: samplePreferences,
                message: `Adding a ${samplePreferences.type} sample to your project`
            },
            message: aiResponse
        }
    }
    
    private parseSamplePreferences(userMessage: string): {
        type: string
        speed: 'slow' | 'medium' | 'fast' | 'any'
        mood: string
        category: string
    } {
        const lowerMessage = userMessage.toLowerCase()
        
        // Determine sample type
        let type = 'random'
        if (lowerMessage.includes('drum') || lowerMessage.includes('percussion') || lowerMessage.includes('beat')) {
            type = 'drum'
        } else if (lowerMessage.includes('bass') || lowerMessage.includes('low') || lowerMessage.includes('sub')) {
            type = 'bass'
        } else if (lowerMessage.includes('melodic') || lowerMessage.includes('melody') || lowerMessage.includes('lead')) {
            type = 'melodic'
        } else if (lowerMessage.includes('pad') || lowerMessage.includes('ambient') || lowerMessage.includes('atmosphere')) {
            type = 'pad'
        } else if (lowerMessage.includes('fx') || lowerMessage.includes('effect') || lowerMessage.includes('sweep')) {
            type = 'fx'
        }
        
        // Determine speed preference
        let speed: 'slow' | 'medium' | 'fast' | 'any' = 'any'
        if (lowerMessage.includes('slow') || lowerMessage.includes('chill') || lowerMessage.includes('relaxed')) {
            speed = 'slow'
        } else if (lowerMessage.includes('fast') || lowerMessage.includes('energetic') || lowerMessage.includes('upbeat')) {
            speed = 'fast'
        } else if (lowerMessage.includes('medium') || lowerMessage.includes('moderate')) {
            speed = 'medium'
        }
        
        // Determine mood
        let mood = 'any'
        if (lowerMessage.includes('dark') || lowerMessage.includes('moody') || lowerMessage.includes('atmospheric')) {
            mood = 'dark'
        } else if (lowerMessage.includes('bright') || lowerMessage.includes('happy') || lowerMessage.includes('uplifting')) {
            mood = 'bright'
        } else if (lowerMessage.includes('aggressive') || lowerMessage.includes('heavy') || lowerMessage.includes('intense')) {
            mood = 'aggressive'
        }
        
        // Determine category
        let category = 'any'
        if (lowerMessage.includes('electronic') || lowerMessage.includes('synth') || lowerMessage.includes('digital')) {
            category = 'electronic'
        } else if (lowerMessage.includes('acoustic') || lowerMessage.includes('organic') || lowerMessage.includes('natural')) {
            category = 'acoustic'
        } else if (lowerMessage.includes('vocal') || lowerMessage.includes('voice') || lowerMessage.includes('singing')) {
            category = 'vocal'
        }
        
        return { type, speed, mood, category }
    }
    
    private async applySampleControl(sampleControl: SampleControl): Promise<void> {
        try {
            console.log('🎵 Applying sample control:', sampleControl)
            
            if (sampleControl.type === 'add_sample') {
                if (sampleControl.parameters.preferences) {
                    await this.addSmartSample(sampleControl.parameters.preferences)
                } else {
                    await this.addRandomSample()
                }
            }
            
        } catch (error) {
            console.error('🎵 Error applying sample control:', error)
        }
    }
    
    private async addRandomSample(): Promise<void> {
        try {
            console.log('🎵 Adding random sample to project...')
            
            // Get available samples from the API
            const samples = await SampleApi.all()
            console.log('🎵 Available samples:', samples.length)
            
            if (samples.length === 0) {
                console.warn('🎵 No samples available')
                return
            }
            
            // Pick a random sample
            const randomSample = samples[Math.floor(Math.random() * samples.length)]
            console.log('🎵 Selected random sample:', randomSample.name)
            
            // Add the sample to the project
            await this.addSampleToProject(randomSample)
            
        } catch (error) {
            console.error('🎵 Error adding random sample:', error)
        }
    }
    
    private async addSmartSample(preferences: any): Promise<void> {
        try {
            console.log('🎵 Adding smart sample with preferences:', preferences)
            
            // Get available samples from the API
            const samples = await SampleApi.all()
            console.log('🎵 Available samples:', samples.length)
            
            if (samples.length === 0) {
                console.warn('🎵 No samples available')
                return
            }
            
            // Filter samples based on preferences
            let filteredSamples = samples
            
            // Filter by type (using sample name patterns)
            if (preferences.type !== 'random') {
                filteredSamples = filteredSamples.filter(sample => {
                    const name = sample.name.toLowerCase()
                    switch (preferences.type) {
                        case 'drum':
                            return name.includes('drum') || name.includes('kick') || name.includes('snare') || 
                                   name.includes('hat') || name.includes('perc') || name.includes('beat')
                        case 'bass':
                            return name.includes('bass') || name.includes('sub') || name.includes('low') ||
                                   name.includes('kick') || name.includes('808')
                        case 'melodic':
                            return name.includes('melody') || name.includes('lead') || name.includes('arp') ||
                                   name.includes('chord') || name.includes('piano') || name.includes('synth')
                        case 'pad':
                            return name.includes('pad') || name.includes('ambient') || name.includes('atmosphere') ||
                                   name.includes('drone') || name.includes('texture')
                        case 'fx':
                            return name.includes('fx') || name.includes('effect') || name.includes('sweep') ||
                                   name.includes('transition') || name.includes('riser')
                        default:
                            return true
                    }
                })
            }
            
            // Filter by speed (using BPM if available)
            if (preferences.speed !== 'any') {
                filteredSamples = filteredSamples.filter(sample => {
                    const bpm = sample.bpm || 120
                    switch (preferences.speed) {
                        case 'slow':
                            return bpm < 100
                        case 'medium':
                            return bpm >= 100 && bpm <= 140
                        case 'fast':
                            return bpm > 140
                        default:
                            return true
                    }
                })
            }
            
            // Filter by mood (using name patterns)
            if (preferences.mood !== 'any') {
                filteredSamples = filteredSamples.filter(sample => {
                    const name = sample.name.toLowerCase()
                    switch (preferences.mood) {
                        case 'dark':
                            return name.includes('dark') || name.includes('moody') || name.includes('atmospheric') ||
                                   name.includes('ambient') || name.includes('drone')
                        case 'bright':
                            return name.includes('bright') || name.includes('happy') || name.includes('uplifting') ||
                                   name.includes('cheerful') || name.includes('energetic')
                        case 'aggressive':
                            return name.includes('aggressive') || name.includes('heavy') || name.includes('intense') ||
                                   name.includes('distorted') || name.includes('industrial')
                        default:
                            return true
                    }
                })
            }
            
            // Filter by category (using name patterns)
            if (preferences.category !== 'any') {
                filteredSamples = filteredSamples.filter(sample => {
                    const name = sample.name.toLowerCase()
                    switch (preferences.category) {
                        case 'electronic':
                            return name.includes('synth') || name.includes('digital') || name.includes('electronic') ||
                                   name.includes('808') || name.includes('chip')
                        case 'acoustic':
                            return name.includes('acoustic') || name.includes('organic') || name.includes('natural') ||
                                   name.includes('piano') || name.includes('guitar') || name.includes('violin')
                        case 'vocal':
                            return name.includes('vocal') || name.includes('voice') || name.includes('singing') ||
                                   name.includes('choir') || name.includes('chant')
                        default:
                            return true
                    }
                })
            }
            
            console.log('🎵 Filtered samples count:', filteredSamples.length)
            
            // If no samples match preferences, fall back to random
            if (filteredSamples.length === 0) {
                console.log('🎵 No samples match preferences, using random selection')
                filteredSamples = samples
            }
            
            // Pick a random sample from filtered results
            const selectedSample = filteredSamples[Math.floor(Math.random() * filteredSamples.length)]
            console.log('🎵 Selected smart sample:', selectedSample.name)
            
            // Add the sample to the project
            await this.addSampleToProject(selectedSample)
            
        } catch (error) {
            console.error('🎵 Error adding smart sample:', error)
        }
    }
    
    private async addSampleToProject(sample: any): Promise<void> {
        try {
            const {editing, boxGraph, rootBoxAdapter} = this.project
            
            editing.modify(() => {
                // Create an audio file box for the sample
                const audioFileBox = AudioFileBox.create(boxGraph, UUID.parse(sample.uuid), box => {
                    box.fileName.setValue(sample.name)
                    box.startInSeconds.setValue(0)
                    box.endInSeconds.setValue(sample.duration || 10) // Default to 10 seconds if no duration
                })
                
                // Create a track for the sample
                const startIndex = rootBoxAdapter.audioUnits.adapters().length
                const {trackBox} = this.project.api.createInstrument(InstrumentFactories.Tape, {index: startIndex})
                
                // Create an audio region box
                const duration = Math.round(PPQN.secondsToPulses(sample.duration || 10, this.getCurrentBpm()))
                AudioRegionBox.create(boxGraph, UUID.generate(), box => {
                    box.position.setValue(0)
                    box.duration.setValue(duration)
                    box.loopDuration.setValue(duration)
                    box.regions.refer(trackBox.regions)
                    box.hue.setValue(ColorCodes.forTrackType(trackBox.type.getValue()))
                    box.label.setValue(sample.name)
                    box.file.refer(audioFileBox)
                })
                
                console.log(`🎵 Successfully added sample "${sample.name}" to project`)
            }, false)
            
        } catch (error) {
            console.error('🎵 Error adding sample to project:', error)
        }
    }
    
    private async applyEffectControl(effectControl: AudioEffectControl): Promise<void> {
        try {
            const {boxGraph} = this.project
            
            // Find all effect boxes of the specified type
            const effectBoxes = boxGraph.boxes.filter(box => {
                if (effectControl.type === 'reverb') {
                    return box instanceof ReverbDeviceBox
                } else if (effectControl.type === 'delay') {
                    return box instanceof DelayDeviceBox
                }
                return false
            })
            
            if (effectBoxes.length === 0) {
                console.warn(`No ${effectControl.type} devices found in the project`)
                return
            }
            
            // Apply parameters to the first found effect box
            const effectBox = effectBoxes[0]
            
            if (effectControl.type === 'reverb' && effectBox instanceof ReverbDeviceBox) {
                this.applyReverbParameters(effectBox, effectControl.parameters)
            } else if (effectControl.type === 'delay' && effectBox instanceof DelayDeviceBox) {
                this.applyDelayParameters(effectBox, effectControl.parameters)
            }
            
        } catch (error) {
            console.error('Error applying effect control:', error)
        }
    }
    
    private async applyTimelineControl(timelineControl: TimelineControl): Promise<void> {
        try {
            console.log('🎵 Applying timeline control:', timelineControl)
            console.log('🎵 Project structure:', this.project)
            
            // Access the timeline box adapter correctly
            const timelineBoxAdapter = this.project.timelineBoxAdapter
            console.log('🎵 TimelineBoxAdapter:', timelineBoxAdapter)
            
            if (!timelineBoxAdapter) {
                console.error('🎵 No timelineBoxAdapter found in project')
                return
            }
            
            if (timelineControl.type === 'bpm') {
                const newBpm = timelineControl.parameters.bpm
                console.log('🎵 Attempting to change BPM to:', newBpm)
                
                if (newBpm !== undefined) {
                    // Clamp BPM between 30 and 1000 (same as ProjectApi)
                    const clampedBpm = Math.max(30, Math.min(1000, newBpm))
                    console.log('🎵 Clamped BPM to:', clampedBpm)
                    
                    // Access the BPM field correctly
                    const bpmField = timelineBoxAdapter.box.bpm
                    console.log('🎵 BPM field:', bpmField)
                    
                    if (bpmField) {
                        // Use the project's editing system to modify BPM
                        // This ensures we're in the proper transaction mode
                        const {editing} = this.project
                        console.log('🎵 Project editing system:', editing)
                        console.log('🎵 Editing system methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(editing)))
                        
                        // Start a modification transaction
                        editing.modify(() => {
                            console.log('🎵 Inside editing transaction, setting BPM...')
                            bpmField.setValue(clampedBpm)
                            console.log(`🎵 BPM successfully changed to ${clampedBpm}`)
                            
                            // Verify the change
                            const newValue = bpmField.getValue()
                            console.log('🎵 Verified new BPM value:', newValue)
                        }, false) // false = don't mark as user edit
                        
                    } else {
                        console.error('🎵 BPM field not found')
                    }
                }
            } else if (timelineControl.type === 'signature') {
                const nominator = timelineControl.parameters.nominator
                const denominator = timelineControl.parameters.denominator
                
                if (nominator !== undefined) {
                    const {editing} = this.project
                    editing.modify(() => {
                        timelineBoxAdapter.box.signature.nominator.setValue(nominator)
                        console.log(`🎵 Time signature nominator changed to ${nominator}`)
                    }, false)
                }
                
                if (denominator !== undefined) {
                    const {editing} = this.project
                    editing.modify(() => {
                        timelineBoxAdapter.box.signature.denominator.setValue(denominator)
                        console.log(`🎵 Time signature denominator changed to ${denominator}`)
                    }, false)
                }
            }
            
        } catch (error) {
            console.error('🎵 Error applying timeline control:', error)
        }
    }
    
    private applyReverbParameters(reverbBox: ReverbDeviceBox, params: Record<string, number>): void {
        const {editing} = this.project
        
        editing.modify(() => {
            if (params.decay !== undefined) reverbBox.decay.setValue(params.decay)
            if (params.preDelay !== undefined) reverbBox.preDelay.setValue(params.preDelay)
            if (params.damp !== undefined) reverbBox.damp.setValue(params.damp)
            if (params.filter !== undefined) reverbBox.filter.setValue(params.filter)
            if (params.wet !== undefined) reverbBox.wet.setValue(params.wet)
            if (params.dry !== undefined) reverbBox.dry.setValue(params.dry)
        }, false)
    }
    
    private applyDelayParameters(delayBox: DelayDeviceBox, params: Record<string, number>): void {
        const {editing} = this.project
        
        editing.modify(() => {
            if (params.delay !== undefined) delayBox.delay.setValue(params.delay)
            if (params.feedback !== undefined) delayBox.feedback.setValue(params.feedback)
            if (params.cross !== undefined) delayBox.cross.setValue(params.cross)
            if (params.filter !== undefined) delayBox.filter.setValue(params.filter)
            if (params.wet !== undefined) delayBox.wet.setValue(params.wet)
            if (params.dry !== undefined) delayBox.dry.setValue(params.dry)
        }, false)
    }
    
    // Test method to verify BPM changes work
    async testBpmChange(): Promise<void> {
        console.log('🎵 Testing BPM change...')
        try {
            // Get current BPM before change
            const currentBpm = this.getCurrentBpm()
            console.log('🎵 Current BPM before change:', currentBpm)
            
            const testControl: TimelineControl = {
                type: 'bpm',
                parameters: { bpm: 140 },
                message: 'Test BPM change to 140'
            }
            
            await this.applyTimelineControl(testControl)
            
            // Get BPM after change
            const newBpm = this.getCurrentBpm()
            console.log('🎵 BPM after change:', newBpm)
            console.log('🎵 Test BPM change completed')
        } catch (error) {
            console.error('🎵 Test BPM change failed:', error)
        }
    }
    
    // Get current BPM value
    getCurrentBpm(): number {
        try {
            const timelineBoxAdapter = this.project.timelineBoxAdapter
            if (timelineBoxAdapter && timelineBoxAdapter.box && timelineBoxAdapter.box.bpm) {
                return timelineBoxAdapter.box.bpm.getValue()
            }
            return 0
        } catch (error) {
            console.error('🎵 Error getting current BPM:', error)
            return 0
        }
    }
}
