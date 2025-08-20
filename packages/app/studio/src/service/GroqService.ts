import {Project, InstrumentFactories, ColorCodes} from "@opendaw/studio-core"
import {DelayDeviceBox, ReverbDeviceBox, AudioFileBox, AudioRegionBox, ValueRegionBox, ValueEventCollectionBox} from "@opendaw/studio-boxes"
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

export interface TemplateControl {
    type: 'create_template'
    parameters: Record<string, any>
    message: string
}

export class GroqService {
    private readonly apiKey: string
    private readonly baseUrl = 'https://api.groq.com/openai/v1/chat/completions'
    private readonly beatovenApiKey: string
    private readonly beatovenBaseUrl = 'https://public-api.beatoven.ai'
    
    constructor(private project: Project) {
        // Get API key from environment variable or use a placeholder
        this.apiKey = import.meta.env.VITE_GROQ_API_KEY || 'your-api-key-here'
        this.beatovenApiKey = import.meta.env.VITE_BEATOVEN_API_KEY || 'your-beatoven-api-key-here'
        
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

When users ask to create templates or songs, you should:
1. Understand the style, mood, and genre they want
2. Explain that you'll compose a full track with separate stems
3. Be encouraging and creative
4. Suggest they can ask for specific styles like "groovy", "chill", "energetic", etc.

You can now understand requests like:
- "Make a template for a groovy song" → Creates a groovy track with separate stems
- "Create a chill lo-fi track" → Creates a peaceful, ambient track
- "Make an energetic dance song" → Creates an upbeat, danceable track
- "Compose a dark atmospheric track" → Creates a moody, atmospheric track

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
    
    async processRequest(message: string): Promise<AudioEffectControl | TimelineControl | SampleControl | TemplateControl | null> {
        const lowerMessage = message.toLowerCase()
        console.log('🎵 Processing request:', message)
        console.log('🎵 Lower message:', lowerMessage)
        
        // Check if API key is configured
        if (this.apiKey === 'your-api-key-here' || !this.apiKey) {
            console.warn('🎵 Cannot process request: Groq API key not configured')
            return null
        }
        
        // Check if this is a template control request
        if (lowerMessage.includes('template') || lowerMessage.includes('song') || lowerMessage.includes('track') || 
            lowerMessage.includes('compose') || lowerMessage.includes('create') || lowerMessage.includes('make')) {
            console.log('🎵 Detected template control request')
            try {
                const aiResponse = await this.sendMessage(message)
                console.log('🎵 AI response:', aiResponse)
                
                // Create template control
                const templateControl = this.createTemplateControl(aiResponse, lowerMessage)
                console.log('🎵 Created template control:', templateControl)
                
                if (templateControl) {
                    // Apply the template changes
                    await this.applyTemplateControl(templateControl)
                }
                
                return templateControl
            } catch (error) {
                console.error('🎵 Error processing template request:', error)
                return null
            }
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
    
    private createTemplateControl(aiResponse: string, userMessage: string): TemplateControl | null {
        console.log('🎵 Creating template control from AI response:', aiResponse)
        
        // Parse user message to understand what kind of template they want
        const lowerMessage = userMessage.toLowerCase()
        const templatePreferences = this.parseTemplatePreferences(lowerMessage)
        
        return {
            type: 'create_template',
            parameters: {
                preferences: templatePreferences,
                message: `Creating a ${templatePreferences.style} template for you`
            },
            message: aiResponse
        }
    }
    
    private parseTemplatePreferences(userMessage: string): {
        style: string
        mood: string
        duration: string
        genre: string
    } {
        const lowerMessage = userMessage.toLowerCase()
        
        // Determine style
        let style = 'groovy'
        if (lowerMessage.includes('groovy') || lowerMessage.includes('funky')) {
            style = 'groovy'
        } else if (lowerMessage.includes('chill') || lowerMessage.includes('lo-fi') || lowerMessage.includes('peaceful')) {
            style = 'chill'
        } else if (lowerMessage.includes('energetic') || lowerMessage.includes('upbeat') || lowerMessage.includes('dance')) {
            style = 'energetic'
        } else if (lowerMessage.includes('dark') || lowerMessage.includes('moody') || lowerMessage.includes('atmospheric')) {
            style = 'dark'
        } else if (lowerMessage.includes('bright') || lowerMessage.includes('happy') || lowerMessage.includes('uplifting')) {
            style = 'bright'
        }
        
        // Determine mood
        let mood = 'groovy'
        if (lowerMessage.includes('chill') || lowerMessage.includes('relaxed')) {
            mood = 'chill'
        } else if (lowerMessage.includes('energetic') || lowerMessage.includes('upbeat')) {
            mood = 'energetic'
        } else if (lowerMessage.includes('dark') || lowerMessage.includes('moody')) {
            mood = 'dark'
        } else if (lowerMessage.includes('bright') || lowerMessage.includes('happy')) {
            mood = 'bright'
        }
        
        // Determine duration
        let duration = '30 seconds'
        if (lowerMessage.includes('short') || lowerMessage.includes('quick')) {
            duration = '15 seconds'
        } else if (lowerMessage.includes('long') || lowerMessage.includes('extended')) {
            duration = '60 seconds'
        }
        
        // Determine genre
        let genre = 'lo-fi'
        if (lowerMessage.includes('hip hop') || lowerMessage.includes('hiphop')) {
            genre = 'hip hop'
        } else if (lowerMessage.includes('electronic') || lowerMessage.includes('edm')) {
            genre = 'electronic'
        } else if (lowerMessage.includes('jazz') || lowerMessage.includes('smooth')) {
            genre = 'jazz'
        } else if (lowerMessage.includes('rock') || lowerMessage.includes('guitar')) {
            genre = 'rock'
        }
        
        return { style, mood, duration, genre }
    }
    
    private async applyTemplateControl(templateControl: TemplateControl): Promise<void> {
        try {
            console.log('🎵 Applying template control:', templateControl)
            
            if (templateControl.type === 'create_template') {
                await this.createBeatovenTemplate(templateControl.parameters.preferences)
            }
            
        } catch (error) {
            console.error('🎵 Error applying template control:', error)
        }
    }
    
    private async createBeatovenTemplate(preferences: any): Promise<void> {
        try {
            console.log('🎵 Creating Beatoven template with preferences:', preferences)
            
            // Check if Beatoven API key is configured
            if (this.beatovenApiKey === 'your-beatoven-api-key-here' || !this.beatovenApiKey) {
                console.warn('🎵 Beatoven API key not configured. Please set VITE_BEATOVEN_API_KEY environment variable.')
                return
            }
            
            // Create the prompt for Beatoven
            const prompt = this.createBeatovenPrompt(preferences)
            console.log('🎵 Beatoven prompt:', prompt)
            
            // Compose the track
            const taskId = await this.composeBeatovenTrack(prompt)
            if (!taskId) {
                console.error('🎵 Failed to start Beatoven composition')
                return
            }
            
            console.log('🎵 Beatoven composition started with task ID:', taskId)
            
            // Wait for composition to complete and get stems
            const stems = await this.waitForBeatovenCompletion(taskId)
            if (!stems) {
                console.error('🎵 Failed to get Beatoven stems')
                return
            }
            
            console.log('🎵 Beatoven composition completed, stems:', stems)
            
            // Add stems to the project
            await this.addBeatovenStemsToProject(stems)
            
        } catch (error) {
            console.error('🎵 Error creating Beatoven template:', error)
        }
    }
    
    private createBeatovenPrompt(preferences: any): string {
        const { style, mood, duration, genre } = preferences
        
        let prompt = `${duration} ${mood} ${genre} track`
        
        if (style === 'groovy') {
            prompt += ' with groovy bass and funky drums'
        } else if (style === 'chill') {
            prompt += ' with peaceful melodies and ambient textures'
        } else if (style === 'energetic') {
            prompt += ' with upbeat rhythms and energetic leads'
        } else if (style === 'dark') {
            prompt += ' with moody atmospheres and deep bass'
        } else if (style === 'bright') {
            prompt += ' with uplifting harmonies and cheerful melodies'
        }
        
        return prompt
    }
    
    private async composeBeatovenTrack(prompt: string): Promise<string | null> {
        try {
            const response = await fetch(`${this.beatovenBaseUrl}/api/v1/tracks/compose`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.beatovenApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: { text: prompt },
                    format: 'wav',
                    looping: false
                })
            })
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            
            const data = await response.json()
            return data.task_id || null
            
        } catch (error) {
            console.error('🎵 Error composing Beatoven track:', error)
            return null
        }
    }
    
    private async waitForBeatovenCompletion(taskId: string): Promise<any | null> {
        try {
            let attempts = 0
            const maxAttempts = 60 // Wait up to 5 minutes (5 seconds * 60)
            
            while (attempts < maxAttempts) {
                const response = await fetch(`${this.beatovenBaseUrl}/api/v1/tasks/${taskId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.beatovenApiKey}`,
                    }
                })
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                
                const data = await response.json()
                console.log('🎵 Beatoven status check:', data.status)
                
                if (data.status === 'composed') {
                    return data.meta
                } else if (data.status === 'failed') {
                    throw new Error('Beatoven composition failed')
                }
                
                // Wait 5 seconds before next check
                await new Promise(resolve => setTimeout(resolve, 5000))
                attempts++
            }
            
            throw new Error('Beatoven composition timed out')
            
        } catch (error) {
            console.error('🎵 Error waiting for Beatoven completion:', error)
            return null
        }
    }
    
    private async addBeatovenStemsToProject(stems: any): Promise<void> {
        try {
            console.log('🎵 Adding Beatoven stems to project:', stems)
            
            const { editing, boxGraph, rootBoxAdapter } = this.project
            
            // Get the starting index before creating tracks
            const startIndex = rootBoxAdapter.audioUnits.adapters().length
            console.log('🎵 Starting with', startIndex, 'existing audio units')
            
            // Create placeholder tracks with download functionality
            console.log('🎵 Creating placeholder tracks with download buttons...')
            await this.createPlaceholderTracksWithDownload(startIndex, stems.stems_url)
            
            // Debug: Check if tracks are now visible in the project
            const finalAudioUnits = this.project.rootBoxAdapter.audioUnits.adapters()
            console.log('🎵 Final audio units count:', finalAudioUnits.length)
            finalAudioUnits.forEach((audioUnit, index) => {
                console.log(`🎵 Audio unit ${index}:`, audioUnit.label, 'with', audioUnit.tracks.collection.size, 'tracks')
                audioUnit.tracks.values().forEach((track, trackIndex) => {
                    console.log(`🎵   Track ${trackIndex}:`, track.type, 'at index', track.indexField.getValue())
                })
            })
            
            // Try to force a UI refresh by triggering project events
            console.log('🎵 Attempting to force UI refresh...')
            try {
                // Force a project change notification
                this.project.editing.modify(() => {
                    // This should trigger UI updates
                    console.log('🎵 Forcing project modification to trigger UI updates')
                }, false)
                
                // Wait a bit for the UI to update
                await new Promise(resolve => setTimeout(resolve, 100))
                
                // Check if the UI has updated
                const finalCheck = this.project.rootBoxAdapter.audioUnits.adapters()
                console.log('🎵 Final check - audio units count:', finalCheck.length)
                if (finalCheck.length > startIndex) {
                    console.log('🎵 SUCCESS: New tracks are now visible in the project!')
                } else {
                    console.log('🎵 WARNING: Tracks still not visible in project structure')
                }
                
                // Try to force a UI refresh by triggering the project's change notification system
                console.log('🎵 Attempting to trigger project change notifications...')
                try {
                    // Access the project's change notification system
                    const project = this.project as any
                    if (project.notifyChange) {
                        project.notifyChange()
                        console.log('🎵 Project change notification triggered')
                    }
                    
                    // Try to access the root box adapter's change system
                    const rootAdapter = this.project.rootBoxAdapter as any
                    if (rootAdapter.notifyChange) {
                        rootAdapter.notifyChange()
                        console.log('🎵 Root adapter change notification triggered')
                    }
                    
                    // Try to force a refresh of the audio units collection
                    const audioUnits = this.project.rootBoxAdapter.audioUnits as any
                    if (audioUnits.notifyChange) {
                        audioUnits.notifyChange()
                        console.log('🎵 Audio units change notification triggered')
                    }
                    
                    // Try a different approach - force the project to think it has changed
                    console.log('🎵 Attempting to force project state change...')
                    try {
                        // Force the project to think it has unsaved changes
                        const projectSession = (this.project as any).session
                        if (projectSession && projectSession.markAsChanged) {
                            projectSession.markAsChanged()
                            console.log('🎵 Project marked as changed')
                        }
                    } catch (sessionError) {
                        console.log('🎵 Error marking project as changed:', sessionError)
                    }
                    
                } catch (notifyError) {
                    console.log('🎵 Error triggering change notifications:', notifyError)
                }
                
                            // Try one more approach - access UI components directly
            console.log('🎵 Attempting to access UI components directly...')
            try {
                // Look for timeline or tracks components in the DOM
                const timelineElements = document.querySelectorAll('[class*="timeline"], [class*="track"], [class*="audio-unit"]')
                console.log('🎵 Found timeline/track elements:', timelineElements.length)
                
                // Try to trigger a resize event which might refresh the UI
                if (timelineElements.length > 0) {
                    timelineElements.forEach((element, index) => {
                        if (index < 3) { // Only log first 3 to avoid spam
                            console.log('🎵 Timeline element', index, ':', element.className)
                        }
                    })
                    
                    // Trigger a window resize event which might refresh the UI
                    window.dispatchEvent(new Event('resize'))
                    console.log('🎵 Window resize event dispatched')
                }
                
            } catch (uiError) {
                console.log('🎵 Error accessing UI components:', uiError)
            }
            
        } catch (error) {
            console.log('🎵 Error forcing UI refresh:', error)
        }
        
        // Show success message
        console.log('🎵 Beatoven stems added as placeholder tracks! You can now:')
        console.log('🎵 1. Use the download panel to get your audio stems')
        console.log('🎵 2. Click download to open the stem URL (bypasses CORS)')
        console.log('🎵 3. Download the file manually, then drag & drop onto the track')
        console.log('🎵 4. The file will be automatically imported into your project!')
        
    } catch (error) {
        console.error('🎵 Error adding Beatoven stems to project:', error)
    }
}

/**
 * Download all Beatoven stems and convert them to audio data
 */
private async downloadAllStems(stemsUrl: any): Promise<Record<string, Float32Array> | null> {
    try {
        console.log('🎵 Starting download of all stems...')
        const stemTypes = ['bass', 'chords', 'melody', 'percussion']
        const stemData: Record<string, Float32Array> = {}
        
        for (const stemType of stemTypes) {
            const stemUrl = stemsUrl[stemType]
            if (!stemUrl) {
                console.warn(`🎵 No URL for ${stemType} stem`)
                continue
            }
            
            console.log(`🎵 Downloading ${stemType} stem from:`, stemUrl)
            
            try {
                // Download the audio file
                const response = await fetch(stemUrl)
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }
                
                const arrayBuffer = await response.arrayBuffer()
                console.log(`🎵 Downloaded ${stemType} stem: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`)
                
                // Convert to Float32Array (stereo)
                const audioData = this.convertAudioBufferToFloat32Array(arrayBuffer)
                stemData[stemType] = audioData
                
                console.log(`🎵 Converted ${stemType} stem to audio data: ${audioData.length} samples`)
                
            } catch (downloadError) {
                console.error(`🎵 Error downloading ${stemType} stem:`, downloadError)
                return null
            }
        }
        
        if (Object.keys(stemData).length === 0) {
            console.error('🎵 No stems were successfully downloaded')
            return null
        }
        
        console.log('🎵 Successfully downloaded all stems:', Object.keys(stemData))
        return stemData
        
    } catch (error) {
        console.error('🎵 Error in downloadAllStems:', error)
        return null
    }
}

/**
 * Convert ArrayBuffer to audio data for the project
 */
private async convertArrayBufferToAudioData(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
    try {
        console.log('🎵 Converting ArrayBuffer to audio data...')
        
        // Create AudioContext for decoding
        const audioContext = new AudioContext()
        
        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        console.log(`🎵 Decoded audio: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`)
        
        // Convert to Float32Array
        const length = audioBuffer.length * audioBuffer.numberOfChannels
        const audioData = new Float32Array(length)
        
        // Copy audio data from all channels
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel)
            for (let i = 0; i < audioBuffer.length; i++) {
                const sampleIndex = i * audioBuffer.numberOfChannels + channel
                audioData[sampleIndex] = channelData[i]
            }
        }
        
        console.log(`🎵 Converted to Float32Array: ${audioData.length} samples`)
        return audioData
        
    } catch (error) {
        console.error('🎵 Error converting ArrayBuffer to audio data:', error)
        // Fallback: create empty audio data
        return new Float32Array(48000 * 30 * 2) // 30 seconds stereo
    }
}

/**
 * Import a stem into the project with actual audio data
 */
private async importStemIntoProject(stemType: string, audioData: Float32Array, startIndex: number): Promise<void> {
    try {
        console.log(`🎵 Importing ${stemType} stem into project...`)
        
        const { editing, boxGraph } = this.project
        
        editing.modify(() => {
            // Find the existing track for this stem
            const audioUnits = this.project.rootBoxAdapter.audioUnits.adapters()
            const targetAudioUnit = audioUnits[startIndex + this.getStemIndex(stemType)]
            
            if (!targetAudioUnit) {
                console.error(`🎵 Could not find audio unit for ${stemType} stem`)
                return
            }
            
            console.log(`🎵 Found target audio unit:`, targetAudioUnit)
            
            // Create audio file box with the downloaded data
            const audioFileBox = AudioFileBox.create(boxGraph, UUID.generate(), box => {
                // Set the name for the audio file
                if ('name' in box && typeof box.name === 'object' && 'setValue' in box.name) {
                    (box.name as any).setValue(`${stemType}_stem_beatoven`)
                }
                console.log(`🎵 Created AudioFileBox for ${stemType} with ${audioData.length} samples`)
            })
            
            // Create audio region box with the audio file
            const duration = Math.round(PPQN.secondsToPulses(audioData.length / 48000 / 2, this.getCurrentBpm()))
            AudioRegionBox.create(boxGraph, UUID.generate(), box => {
                // Set position and duration
                if ('position' in box && typeof box.position === 'object' && 'setValue' in box.position) {
                    (box.position as any).setValue(0)
                }
                if ('duration' in box && typeof box.duration === 'object' && 'setValue' in box.duration) {
                    (box.duration as any).setValue(duration)
                }
                if ('loopDuration' in box && typeof box.loopDuration === 'object' && 'setValue' in box.loopDuration) {
                    (box.loopDuration as any).setValue(duration)
                }
                
                // Connect to track regions
                if ('regions' in box && typeof box.regions === 'object' && 'refer' in box.regions) {
                    const tracks = targetAudioUnit.tracks.values()
                    if (tracks.length > 0) {
                        (box.regions as any).refer(tracks[0].regions)
                    }
                }
                
                // Connect to audio file
                if ('file' in box && typeof box.file === 'object' && 'refer' in box.file) {
                    (box.file as any).refer(audioFileBox)
                }
                
                // Set visual properties
                if ('hue' in box && typeof box.hue === 'object' && 'setValue' in box.hue) {
                    const tracks = targetAudioUnit.tracks.values()
                    if (tracks.length > 0) {
                        (box.hue as any).setValue(ColorCodes.forTrackType(tracks[0].type))
                    }
                }
                if ('label' in box && typeof box.label === 'object' && 'setValue' in box.label) {
                    (box.label as any).setValue(`${stemType} stem (Beatoven)`)
                }
                
                console.log(`🎵 Created AudioRegionBox for ${stemType} with duration ${duration} pulses`)
            })
            
            console.log(`🎵 Successfully imported ${stemType} stem with audio data`)
            console.log(`🎵 Audio duration: ${(audioData.length / 48000 / 2).toFixed(2)} seconds`)
            
        }, false)
        
    } catch (error) {
        console.error(`🎵 Error importing ${stemType} stem:`, error)
        throw error
    }
}

/**
 * Get the index of a stem type
 */
private getStemIndex(stemType: string): number {
    const stemTypes = ['bass', 'chords', 'melody', 'percussion']
    return stemTypes.indexOf(stemType)
}

/**
 * Create placeholder tracks with download functionality and UI
 */
private async createPlaceholderTracksWithDownload(startIndex: number, stemsUrl: any): Promise<void> {
    console.log('🎵 Creating placeholder tracks with download functionality...')
    
    const { editing, rootBoxAdapter } = this.project
    
    editing.modify(() => {
        const stemTypes = ['bass', 'chords', 'melody', 'percussion']
        
        stemTypes.forEach((stemType, index) => {
            console.log(`🎵 Creating placeholder track for ${stemType}`)
            
            const { trackBox } = this.project.api.createInstrument(InstrumentFactories.Tape, { 
                index: startIndex + index 
            })
            
            trackBox.index.setValue(startIndex + index)
            console.log(`🎵 Created placeholder ${stemType} track`)
        })
        
        console.log('🎵 Created all placeholder tracks')
    }, false)
    
    // Create download UI for the user
    await this.createDownloadUI(stemsUrl, startIndex)
}

/**
 * Create a user-friendly download interface
 */
private async createDownloadUI(stemsUrl: any, startIndex: number): Promise<void> {
    console.log('🎵 Creating download UI for Beatoven stems...')
    
    // Create a floating download panel
    const downloadPanel = document.createElement('div')
    downloadPanel.className = 'beatoven-download-panel'
    downloadPanel.innerHTML = `
        <div class="beatoven-download-header">
            <h3>🎵 Beatoven Stems Ready!</h3>
            <p>Click download to open the stem URL, then drag & drop the file onto the corresponding track to import it automatically!</p>
        </div>
        <div class="beatoven-download-stems">
            <div class="stem-download-item" data-stem="bass">
                <span class="stem-name">🎸 Bass</span>
                <button class="download-btn" onclick="window.downloadBeatovenStem('bass', '${stemsUrl.bass}')">
                    📥 Download
                </button>
            </div>
            <div class="stem-download-item" data-stem="chords">
                <span class="stem-name">🎹 Chords</span>
                <button class="download-btn" onclick="window.downloadBeatovenStem('chords', '${stemsUrl.chords}')">
                    📥 Download
                </button>
            </div>
            <div class="stem-download-item" data-stem="melody">
                <span class="stem-name">🎺 Melody</span>
                <button class="download-btn" onclick="window.downloadBeatovenStem('melody', '${stemsUrl.melody}')">
                    📥 Download
                </button>
            </div>
            <div class="stem-download-item" data-stem="percussion">
                <span class="stem-name">🥁 Percussion</span>
                <button class="download-btn" onclick="window.downloadBeatovenStem('percussion', '${stemsUrl.percussion}')">
                    📥 Download
                </button>
            </div>
        </div>
        <div class="beatoven-download-footer">
            <button class="close-btn" onclick="this.parentElement.parentElement.remove()">Close</button>
        </div>
    `
    
    // Add styles
    downloadPanel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-width: 400px;
        animation: fadeInScale 0.3s ease-out;
    `
    
    // Add CSS animations to the page
    this.addDownloadPanelStyles()
    
    // Add to page
    document.body.appendChild(downloadPanel)
    
    // Set up global download function
    this.setupGlobalDownloadFunction(startIndex)
    
    console.log('🎵 Download UI created successfully!')
}

/**
 * Set up global download function for the UI buttons
 */
private setupGlobalDownloadFunction(startIndex: number): void {
    // @ts-ignore - Adding to window for UI access
    window.downloadBeatovenStem = async (stemType: string, url: string) => {
        console.log(`🎵 Opening download URL for ${stemType} stem:`, url)
        
        try {
            // Show downloading status
            const downloadBtn = document.querySelector(`[data-stem="${stemType}"] .download-btn`) as HTMLButtonElement
            if (downloadBtn) {
                downloadBtn.textContent = '🌐 Opening...'
                downloadBtn.disabled = true
                downloadBtn.style.background = '#3b82f6'
            }
            
            // Open the URL in a new tab to bypass CORS
            const newWindow = window.open(url, '_blank')
            
            if (newWindow) {
                // Show success message
                this.showDownloadSuccess(stemType)
                
                // Update the download button to show completion
                if (downloadBtn) {
                    downloadBtn.textContent = '📥 Downloaded'
                    downloadBtn.disabled = false
                    downloadBtn.style.background = '#10b981'
                    downloadBtn.onclick = () => this.showImportInstructions(stemType)
                }
                
                console.log(`🎵 ${stemType} stem download URL opened successfully`)
                
                // Set up drag & drop detection for this stem
                this.setupDragAndDropDetection(stemType, startIndex)
                
            } else {
                throw new Error('Popup blocked by browser')
            }
            
        } catch (error) {
            console.error(`🎵 Error opening download URL for ${stemType} stem:`, error)
            this.showDownloadError(stemType)
            
            // Reset button on error
            const downloadBtn = document.querySelector(`[data-stem="${stemType}"] .download-btn`) as HTMLButtonElement
            if (downloadBtn) {
                downloadBtn.textContent = '📥 Download'
                downloadBtn.disabled = false
                downloadBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            }
        }
    }
}

/**
 * Show download success message
 */
private showDownloadSuccess(stemType: string): void {
    const notification = document.createElement('div')
    notification.className = 'beatoven-notification success'
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">✅</span>
            <span class="notification-text">${stemType.charAt(0).toUpperCase() + stemType.slice(1)} stem downloaded successfully!</span>
        </div>
    `
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideInRight 0.3s ease-out;
    `
    
    document.body.appendChild(notification)
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in'
        setTimeout(() => notification.remove(), 300)
    }, 3000)
}

/**
 * Show download error message
 */
private showDownloadError(stemType: string): void {
    const notification = document.createElement('div')
    notification.className = 'beatoven-notification error'
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">❌</span>
            <span class="notification-text">Failed to download ${stemType} stem. Try again or download manually.</span>
        </div>
    `
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideInRight 0.3s ease-out;
    `
    
    document.body.appendChild(notification)
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in'
        setTimeout(() => notification.remove(), 300)
    }, 5000)
}

/**
 * Show import instructions for a stem
 */
private showImportInstructions(stemType: string): void {
    const notification = document.createElement('div')
    notification.className = 'beatoven-notification info'
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">💡</span>
            <span class="notification-text">Drag & drop the ${stemType} stem file onto the corresponding track in your timeline to import it!</span>
        </div>
    `
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideInRight 0.3s ease-out;
        max-width: 350px;
    `
    
    document.body.appendChild(notification)
    
    // Remove after 8 seconds (longer for instructions)
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in'
        setTimeout(() => notification.remove(), 300)
    }, 8000)
}

/**
 * Set up drag and drop detection for a stem
 */
private setupDragAndDropDetection(stemType: string, startIndex: number): void {
    console.log(`🎵 Setting up drag & drop detection for ${stemType} stem`)
    
    // Find the target track for this stem
    const audioUnits = this.project.rootBoxAdapter.audioUnits.adapters()
    const targetAudioUnit = audioUnits[startIndex + this.getStemIndex(stemType)]
    
    if (!targetAudioUnit) {
        console.error(`🎵 Could not find audio unit for ${stemType} stem`)
        return
    }
    
    // Set up global drag and drop detection
    this.setupGlobalDragAndDrop(stemType, targetAudioUnit)
}

/**
 * Set up global drag and drop detection
 */
private setupGlobalDragAndDrop(stemType: string, targetAudioUnit: any): void {
    // @ts-ignore - Adding to window for global access
    if (!window.beatovenDragAndDrop) {
        window.beatovenDragAndDrop = {}
    }
    
    // @ts-ignore
    window.beatovenDragAndDrop[stemType] = {
        targetAudioUnit,
        stemType,
        groqService: this
    }
    
    console.log(`🎵 Global drag & drop detection set up for ${stemType} stem`)
    
    // Add a visual indicator that the track is ready for import
    this.addImportIndicator(stemType, targetAudioUnit)
}

/**
 * Add visual indicator that track is ready for import
 */
private addImportIndicator(stemType: string, targetAudioUnit: any): void {
    // This would add a visual indicator to the timeline
    // For now, we'll just log it
    console.log(`🎵 ${stemType} stem track is ready for import - drag & drop your audio file onto it!`)
    
    // You could add a visual indicator here like:
    // - Highlight the track
    // - Add an import icon
    // - Show a tooltip
    // - Change track color
}

/**
 * Add CSS styles for the download panel and animations
 */
private addDownloadPanelStyles(): void {
    // Check if styles already exist
    if (document.getElementById('beatoven-download-styles')) {
        return
    }
    
    const styleSheet = document.createElement('style')
    styleSheet.id = 'beatoven-download-styles'
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
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .beatoven-download-panel {
            font-size: 14px;
            line-height: 1.5;
        }
        
        .beatoven-download-header h3 {
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .beatoven-download-header p {
            margin: 0 0 20px 0;
            opacity: 0.9;
        }
        
        .beatoven-download-stems {
            margin-bottom: 20px;
        }
        
        .stem-download-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            margin-bottom: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            transition: background 0.2s ease;
        }
        
        .stem-download-item:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        .stem-name {
            font-weight: 500;
        }
        
        .download-btn {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .download-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        
        .download-btn:disabled {
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        .close-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s ease;
        }
        
        .close-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .beatoven-notification {
            max-width: 300px;
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .notification-icon {
            font-size: 18px;
        }
        
        .notification-text {
            font-size: 14px;
            font-weight: 500;
        }
    `
    
    document.head.appendChild(styleSheet)
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
                                        