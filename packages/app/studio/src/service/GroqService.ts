import {Project} from "@opendaw/studio-core"
import {DelayDeviceBox, ReverbDeviceBox} from "@opendaw/studio-boxes"
import {BoxAdapter} from "@opendaw/studio-adapters"

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
                            content: `You are an AI music production assistant for openDAW. You can help users with music production questions and control audio effects like reverb and delay, as well as timeline settings like BPM and time signature.

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
    
    async processRequest(message: string): Promise<AudioEffectControl | TimelineControl | null> {
        const lowerMessage = message.toLowerCase()
        console.log('🎵 Processing request:', message)
        console.log('🎵 Lower message:', lowerMessage)
        
        // Check if API key is configured
        if (this.apiKey === 'your-api-key-here' || !this.apiKey) {
            console.warn('🎵 Cannot process request: Groq API key not configured')
            return null
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
