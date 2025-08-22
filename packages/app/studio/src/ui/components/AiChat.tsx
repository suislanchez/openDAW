import {createElement, Frag} from "@opendaw/lib-jsx"
import {Icon} from "./Icon.tsx"
import {IconSymbol} from "@opendaw/studio-adapters"
import {Lifecycle, Terminator} from "@opendaw/lib-std"
import {Events} from "@opendaw/lib-dom"
import {GroqService, ChatMessage} from "@/service/GroqService"
import {StudioService} from "@/service/StudioService"
import "./AiChat.sass"

export type AiChatParameters = {
    lifecycle: Lifecycle
    service: StudioService
}

export function AiChat({lifecycle, service}: AiChatParameters) {
    const terminator = lifecycle.own(new Terminator())
    let isOpen = false
    let groqService: GroqService | null = null
    let messages: ChatMessage[] = [
        {
            role: 'assistant',
            content: 'Hello! I\'m here to help you with your music production. What would you like to know?',
            timestamp: new Date()
        }
    ]
    
    // Template selection variables
    let selectedGenre = 'pop'
    let selectedMood = 'calm'
    let selectedStyle = 'cinematic'
    let selectedLength = '60'
    let selectedLooping = true
    
    const toggleChat = () => {
        isOpen = !isOpen
        updateChatVisibility()
        
        // No BPM updates needed
    }
    
    const updateChatVisibility = () => {
        const panel = document.querySelector('.ai-chat-panel') as HTMLElement
        if (panel) {
            panel.style.display = isOpen ? 'flex' : 'none'
        }
    }
    
    const addMessage = (role: 'user' | 'assistant', content: string) => {
        const message: ChatMessage = {
            role,
            content,
            timestamp: new Date()
        }
        messages.push(message)
        updateMessagesDisplay()
        
        // Show visual notification for effect/timeline changes
        if (role === 'assistant' && (content.includes('🎛️ Applied') || content.includes('🎵 Applied'))) {
            showChangeNotification(content)
        }
    }
    
    const showChangeNotification = (message: string) => {
        // Create a floating notification
        const notification = document.createElement('div')
        notification.className = 'ai-chat-notification'
        notification.innerHTML = `
            <div class="ai-chat-notification-content">
                <span class="ai-chat-notification-icon">${message.includes('🎛️') ? '🎛️' : '🎵'}</span>
                <span class="ai-chat-notification-text">${message}</span>
            </div>
        `
        
        document.body.appendChild(notification)
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100)
        
        // Pulse the chat button to draw attention
        const chatButton = document.querySelector('.ai-chat-toggle') as HTMLElement
        if (chatButton) {
            chatButton.classList.add('ai-chat-toggle-pulse')
            setTimeout(() => chatButton.classList.remove('ai-chat-toggle-pulse'), 2000)
        }
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show')
            setTimeout(() => notification.remove(), 300)
        }, 4000)
    }
    
    const updateTemplatePreview = () => {
        const previewElement = document.getElementById('template-preview-text')
        if (previewElement) {
            previewElement.textContent = `${selectedGenre} • ${selectedMood} • ${selectedStyle}`
        }
    }
    
    const updateMessagesDisplay = () => {
        const messagesContainer = document.querySelector('.ai-chat-messages') as HTMLElement
        if (!messagesContainer) return
        
        messagesContainer.innerHTML = ''
        messages.forEach(msg => {
            const messageDiv = document.createElement('div')
            messageDiv.className = `ai-chat-message ai-chat-message-${msg.role}`
            
            if (msg.role === 'user') {
                messageDiv.innerHTML = `
                    <div class="ai-chat-content">
                        <p>${msg.content}</p>
                    </div>
                    <div class="ai-chat-avatar">You</div>
                `
            } else {
                messageDiv.innerHTML = `
                    <div class="ai-chat-avatar">AI</div>
                    <div class="ai-chat-content">
                        <p>${msg.content}</p>
                    </div>
                `
            }
            
            messagesContainer.appendChild(messageDiv)
        })
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
    
    const sendMessage = async () => {
        const input = document.querySelector('.ai-chat-text-input') as HTMLInputElement
        if (!input || !input.value.trim()) return
        
        const userMessage = input.value.trim()
        addMessage('user', userMessage)
        input.value = ''
        
        // Disable input and button while processing
        const sendButton = document.querySelector('.ai-chat-send') as HTMLButtonElement
        input.disabled = true
        sendButton.disabled = true
        
        // Show typing indicator
        addMessage('assistant', '🤔 Thinking...')
        
        try {
            // Initialize GroqService if needed
            if (!groqService) {
                const project = service.project
                groqService = new GroqService(project)
            }
            
            // Check if this is a template request and use selected preferences
            let messageToProcess = userMessage
            if (userMessage.toLowerCase().includes('template') || userMessage.toLowerCase().includes('song') || userMessage.toLowerCase().includes('track')) {
                // Use the user's exact message for Beatoven, don't enhance it
                console.log('🎵 Template request detected, using exact user message for Beatoven')
                
                // For templates, show thinking process immediately and then stream the response
                messages.pop() // Remove typing indicator
                const assistantIndex = messages.length
                messages.push({ role: 'assistant', content: '', timestamp: new Date() })
                updateMessagesDisplay()
                
                // Show template details immediately
                const lengthText = selectedLength === '30' ? '30 seconds' : 
                                  selectedLength === '60' ? '1 minute' : 
                                  selectedLength === '120' ? '2 minutes' : '5 minutes'
                const loopText = selectedLooping ? 'with looping' : 'without looping'
                const templateDetails = `🎵 I'll create a track for you!\n\n🎵 ${lengthText} ${loopText} - starting composition now...`
                
                const messagesContainer = document.querySelector('.ai-chat-messages') as HTMLElement
                const lastMessageEl = messagesContainer?.lastElementChild as HTMLElement | null
                const contentEl = lastMessageEl?.querySelector('.ai-chat-content p') as HTMLElement | null
                
                if (contentEl) {
                    contentEl.textContent = templateDetails
                    messages[assistantIndex].content = templateDetails
                }
                
                // Now stream the AI's response about the template
                await groqService.streamMessage(messageToProcess, (token: string) => {
                    const current = messages[assistantIndex]
                    if (!current) return
                    current.content += token
                    if (contentEl) contentEl.textContent = current.content
                    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight
                })
                
                // Now actually create the Beatoven template
                try {
                    addMessage('assistant', `🎵 Composing your ${selectedStyle} ${selectedMood} ${selectedGenre} track (${lengthText} ${loopText})...`)
                    
                    // Pass the length and looping settings to the service
                    const enhancedMessage = `${userMessage} (${lengthText} ${loopText})`
                    const control = await groqService.processRequest(enhancedMessage)
                    
                    if (control && 'type' in control && control.type === 'create_template') {
                        addMessage('assistant', '🎵 Beatoven is working on your track! This will take a few minutes.')
                        
                        // Add completion message after delay
                        setTimeout(() => {
                            // Check if a specific stem was requested
                            let stemMessage = ''
                            if (groqService && groqService.getRequestedStemType) {
                                const requestedType = groqService.getRequestedStemType()
                                if (requestedType) {
                                    stemMessage = ` (${requestedType} stem only)`
                                }
                            }
                            
                            addMessage('assistant', `🎵 Your ${selectedStyle} ${selectedMood} ${selectedGenre} track${stemMessage} (${lengthText} ${loopText}) is ready! Check your timeline for the new audio tracks.`)
                            
                            // Add download message with individual stem download buttons
                            const songName = `${selectedStyle}_${selectedMood}_${selectedGenre}_${lengthText.replace(' ', '')}`
                            const downloadMessage = document.createElement('div')
                            downloadMessage.className = 'ai-chat-download-message'
                            
                            // Check what stems are available based on the request
                            const availableStems = getAvailableStems()
                            const stemButtons = generateStemButtons(songName, availableStems)
                            
                            downloadMessage.innerHTML = `
                                <div class="ai-chat-content">
                                    <p>📥 Your stems are ready! Download available stems or the full track:</p>
                                    <div class="ai-chat-download-buttons">
                                        ${stemButtons}
                                        <button class="ai-chat-download-btn ai-chat-download-track" onclick="window.downloadBeatovenFullTrack('${songName}')">
                                            <span>⬇️ Download Full Track</span>
                                        </button>
                                        <button class="ai-chat-download-btn ai-chat-download-debug" onclick="window.debugBeatovenStems()" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                                            <span>🔍 Debug Stems Data</span>
                                        </button>
                                    </div>
                                    <p class="ai-chat-download-note">💡 Drag & drop the downloaded files onto your timeline tracks to import them!</p>
                                </div>
                            `
                            
                            // Add to messages container
                            const messagesContainer = document.querySelector('.ai-chat-messages') as HTMLElement
                            if (messagesContainer) {
                                messagesContainer.appendChild(downloadMessage)
                                messagesContainer.scrollTop = messagesContainer.scrollHeight
                            }
                            
                            // Set up global download function
                            setupGlobalDownloadFunction()
                        }, 10000) // 10 seconds delay
                    }
                } catch (error) {
                    console.error('Error creating Beatoven template:', error)
                    addMessage('assistant', '❌ Sorry, I encountered an error while creating the template. Please try again.')
                }
                
                // Re-enable input and button
                input.disabled = false
                sendButton.disabled = false
                input.focus()
                return // Skip the regular control processing for templates
            }
            
            // Process the message (only for non-template requests)
            const control = await groqService.processRequest(messageToProcess)
            
            if (control) {
                // Remove typing indicator and add AI response
                messages.pop()
                addMessage('assistant', control.message)
                
                // Show control info with different styling based on type
                const paramText = Object.entries(control.parameters)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(', ')
                
                if ('type' in control && (control.type === 'reverb' || control.type === 'delay')) {
                    addMessage('assistant', `🎛️ Applied ${control.type} changes: ${paramText}`)
                } else if ('type' in control && (control.type === 'bpm' || control.type === 'signature')) {
                    addMessage('assistant', `🎵 Applied ${control.type} changes: ${paramText}`)
                } else if ('type' in control && control.type === 'add_sample') {
                    addMessage('assistant', `🎵 Added sample to your project! Check the timeline for the new audio track.`)
                }
            } else {
                // Check if it's an API key issue
                if (groqService && groqService.getCurrentBpm() === 0) {
                    // API key not configured
                    messages.pop() // Remove typing indicator
                    addMessage('assistant', '⚠️ Groq API key not configured. Please create a `.env` file with your `VITE_GROQ_API_KEY`. Check the README for setup instructions.')
                } else {
                    // Regular chat response (streamed)
                    messages.pop() // Remove typing indicator
                    const assistantIndex = messages.length
                    messages.push({ role: 'assistant', content: '', timestamp: new Date() })
                    updateMessagesDisplay()
                    const messagesContainer = document.querySelector('.ai-chat-messages') as HTMLElement
                    const lastMessageEl = messagesContainer?.lastElementChild as HTMLElement | null
                    const contentEl = lastMessageEl?.querySelector('.ai-chat-content p') as HTMLElement | null
                    await groqService.streamMessage(userMessage, (token: string) => {
                        const current = messages[assistantIndex]
                        if (!current) return
                        current.content += token
                        if (contentEl) contentEl.textContent = current.content
                        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight
                    })
                }
            }
        } catch (error) {
            console.error('Error processing message:', error)
            messages.pop() // Remove typing indicator
            addMessage('assistant', '❌ Sorry, I encountered an error. Please try again.')
        } finally {
            // Re-enable input and button
            input.disabled = false
            sendButton.disabled = false
            input.focus()
        }
    }
    
    const handleKeyPress = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            sendMessage()
        }
    }
    
    // Set up event listeners
    lifecycle.own(Events.subscribe(document, 'keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen) {
            isOpen = false
            updateChatVisibility()
        }
    }))

    // Helper function to get available stems based on the request
    const getAvailableStems = () => {
        if (groqService && groqService.getRequestedStemType) {
            const requestedType = groqService.getRequestedStemType()
            if (requestedType) {
                // If a specific stem was requested, only show that one
                return [requestedType]
            }
        }
        // If no specific stem was requested, show all stems
        return ['percussion', 'melody', 'bass', 'chords']
    }
    
    // Helper function to generate stem buttons based on availability
    const generateStemButtons = (songName: string, availableStems: string[]) => {
        if (availableStems.length === 1) {
            // Single stem requested - show in a single row
            const stemType = availableStems[0]
            const buttonClass = `ai-chat-download-btn ai-chat-download-${stemType}`
            const icon = getStemIcon(stemType)
            const label = getStemLabel(stemType)
            
            return `
                <div class="ai-chat-stems-single">
                    <button class="${buttonClass}" onclick="window.downloadBeatovenStem('${songName}', '${stemType}')">
                        <span>${icon} ${label}</span>
                    </button>
                </div>
            `
        } else {
            // Multiple stems - show in grid
            const buttonHtml = availableStems.map(stemType => {
                const buttonClass = `ai-chat-download-btn ai-chat-download-${stemType}`
                const icon = getStemIcon(stemType)
                const label = getStemLabel(stemType)
                
                return `<button class="${buttonClass}" onclick="window.downloadBeatovenStem('${songName}', '${stemType}')">
                    <span>${icon} ${label}</span>
                </button>`
            }).join('')
            
            return `<div class="ai-chat-stems-grid">${buttonHtml}</div>`
        }
    }
    
    // Helper function to get stem icon
    const getStemIcon = (stemType: string) => {
        switch (stemType) {
            case 'percussion': return '🥁'
            case 'melody': return '🎵'
            case 'bass': return '🎸'
            case 'chords': return '🎹'
            default: return '🎵'
        }
    }
    
    // Helper function to get stem label
    const getStemLabel = (stemType: string) => {
        switch (stemType) {
            case 'percussion': return 'Percussion'
            case 'melody': return 'Melody'
            case 'bass': return 'Bass'
            case 'chords': return 'Chords'
            default: return stemType.charAt(0).toUpperCase() + stemType.slice(1)
        }
    }

    const setupGlobalDownloadFunction = () => {
        // Extend window with typed properties
        interface BeatovenWindow extends Window {
            downloadBeatovenStem?: (songName?: string, stemType?: string) => void
            downloadBeatovenFullTrack?: (songName?: string) => void
            debugBeatovenStems?: () => void
        }
        const w = window as BeatovenWindow
        
        // Function to download individual stems
        w.downloadBeatovenStem = (songName?: string, stemType?: string) => {
            // Get the stored Beatoven stems data from the service
            if (groqService && groqService.getStoredStems) {
                const stems = groqService.getStoredStems()
                if (stems) {
                    console.log(`🎵 Downloading ${stemType} stem with data:`, stems)
                    console.log(`🎵 Stems data type:`, typeof stems)
                    console.log(`🎵 Stems data keys:`, Object.keys(stems))
                    downloadBeatovenIndividualStem(stems, songName || 'beatoven_track', stemType || 'unknown')
                } else {
                    alert('🎵 No stems data found. Please wait for the composition to complete.')
                }
            } else {
                alert('🎵 Stems service not available. Please wait for the composition to complete.')
            }
        };
        
        // Function to download only the full track
        w.downloadBeatovenFullTrack = (songName?: string) => {
            // Get the stored Beatoven stems data from the service
            if (groqService && groqService.getStoredStems) {
                const stems = groqService.getStoredStems()
                if (stems) {
                    console.log('🎵 Downloading full track with data:', stems)
                    downloadBeatovenFullTrackOnly(stems, songName || 'beatoven_track')
                } else {
                    alert('🎵 No stems data found. Please wait for the composition to complete.')
                }
            } else {
                alert('🎵 Stems service not available. Please wait for the composition to complete.')
            }
        };
        
        // Function to debug stems data
        w.debugBeatovenStems = () => {
            if (groqService && groqService.getStoredStems) {
                const stems = groqService.getStoredStems()
                if (stems) {
                    console.log('🔍 DEBUG: Stems data structure:', stems)
                    console.log('🔍 DEBUG: Stems data type:', typeof stems)
                    console.log('🔍 DEBUG: Stems data keys:', Object.keys(stems))
                    console.log('🔍 DEBUG: Full stems data JSON:', JSON.stringify(stems, null, 2))
                    
                    // Check for different possible structures
                    if (stems.stems_url) {
                        console.log('🔍 DEBUG: Found stems_url:', stems.stems_url)
                        console.log('🔍 DEBUG: Available stem types:', Object.keys(stems.stems_url))
                    }
                    if (stems.stems) {
                        console.log('🔍 DEBUG: Found stems:', stems.stems)
                        console.log('🔍 DEBUG: Available stem types:', Object.keys(stems.stems))
                    }
                    if (stems.urls) {
                        console.log('🔍 DEBUG: Found urls:', stems.urls)
                        if (stems.urls.stems) {
                            console.log('🔍 DEBUG: Available stem types in urls.stems:', Object.keys(stems.urls.stems))
                        }
                    }
                    if (stems.track_url) console.log('🔍 DEBUG: Found track_url:', stems.track_url)
                    if (stems.track) console.log('🔍 DEBUG: Found track:', stems.track)
                    
                    // Check requested stem type
                    if (groqService.getRequestedStemType) {
                        const requestedType = groqService.getRequestedStemType()
                        console.log('🔍 DEBUG: Requested stem type:', requestedType)
                    }
                    
                    alert('🔍 Check console for detailed stems data structure!')
                } else {
                    alert('🔍 No stems data found to debug.')
                }
            } else {
                alert('🔍 Stems service not available for debugging.')
            }
        };
        
        // Download individual stem
        const downloadBeatovenIndividualStem = async (stems: any, songName: string, stemType: string) => {
            try {
                console.log(`🎵 Starting ${stemType} stem download for:`, songName)
                console.log('🎵 Stems data structure:', stems)
                
                // Try different possible data structures
                let stemsUrls = null
                if (stems.stems_url) {
                    stemsUrls = stems.stems_url
                    console.log('🎵 Found stems_url:', stemsUrls)
                } else if (stems.stems) {
                    stemsUrls = stems.stems
                    console.log('🎵 Found stems:', stemsUrls)
                } else if (stems.urls && stems.urls.stems) {
                    stemsUrls = stems.urls.stems
                    console.log('🎵 Found urls.stems:', stemsUrls)
                } else {
                    console.warn('🎵 No stems URLs found in any expected location')
                    console.log('🎵 Available keys in stems data:', Object.keys(stems))
                }
                
                // Download specific stem
                if (stemsUrls && stemsUrls[stemType]) {
                    const stemUrl = stemsUrls[stemType]
                    console.log(`🎵 Downloading ${stemType} stem from:`, stemUrl)
                    
                    try {
                        const stemLink = document.createElement('a')
                        stemLink.href = stemUrl
                        stemLink.download = `${songName}_${stemType}_stem.wav`
                        document.body.appendChild(stemLink)
                        stemLink.click()
                        document.body.removeChild(stemLink)
                        
                        console.log(`🎵 Successfully downloaded ${stemType} stem`)
                        alert(`🎵 Successfully downloaded ${stemType} stem for ${songName}!`)
                    } catch (stemError) {
                        console.error(`Error downloading ${stemType} stem:`, stemError)
                        alert(`❌ Error downloading ${stemType} stem. Please try again.`)
                    }
                } else {
                    console.warn(`🎵 No URL found for ${stemType} stem`)
                    alert(`❌ ${stemType} stem not available for download.`)
                }
            } catch (error) {
                console.error(`Error downloading ${stemType} stem:`, error)
                alert(`❌ Error downloading ${stemType} stem. Please try again.`)
            }
        };
        
        // Download only the full track
        const downloadBeatovenFullTrackOnly = async (stems: any, songName: string) => {
            try {
                console.log('🎵 Starting full track download for:', songName)
                console.log('🎵 Full track data structure:', stems)
                
                // Try different possible data structures for full track
                let trackUrl = null
                if (stems.track_url) {
                    trackUrl = stems.track_url
                    console.log('🎵 Found track_url:', trackUrl)
                } else if (stems.track) {
                    trackUrl = stems.track
                    console.log('🎵 Found track:', trackUrl)
                } else if (stems.urls && stems.urls.track) {
                    trackUrl = stems.urls.track
                    console.log('🎵 Found urls.track:', trackUrl)
                } else if (stems.full_track) {
                    trackUrl = stems.full_track
                    console.log('🎵 Found full_track:', trackUrl)
                } else {
                    console.warn('🎵 No track URL found in any expected location')
                    console.log('🎵 Available keys in stems data:', Object.keys(stems))
                }
                
                // Download full track if available
                if (trackUrl) {
                    const trackLink = document.createElement('a')
                    trackLink.href = trackUrl
                    trackLink.download = `${songName}_full_track.wav`
                    document.body.appendChild(trackLink)
                    trackLink.click()
                    document.body.removeChild(trackLink)
                    
                    console.log('🎵 Successfully downloaded full track')
                    alert(`🎵 Successfully downloaded full track for ${songName}!`)
                } else {
                    alert('❌ Full track not available for download.')
                }
            } catch (error) {
                console.error('Error downloading full track:', error)
                alert('❌ Error downloading full track. Please try again.')
            }
        };
    };
    
    return (
        <Frag>
            {/* Chat Toggle Button - Always visible in bottom right */}
            <button 
                className="ai-chat-toggle"
                onclick={toggleChat}
                title="AI Chat"
            >
                <div className="ai-chat-toggle-icon">
                    <Icon symbol={IconSymbol.Note} style={{width: '22px', height: '22px'}}/>
                    <span className="ai-chat-bubble">💬</span>
                </div>
            </button>

            {/* Chat Panel - Slides up from bottom when open */}
            <div className="ai-chat-panel" style={{display: 'none'}}>
                <div className="ai-chat-header">
                    <div className="ai-chat-header-main">
                        <h3>AI Assistant</h3>
                        <div className="ai-chat-header-options">
                            <div className="ai-chat-option-group">
                                <label>⏱️ Length:</label>
                                <select 
                                    id="template-length" 
                                    onchange={(e) => selectedLength = (e.target as HTMLSelectElement).value}
                                    value={selectedLength}
                                >
                                    <option value="30">30 seconds</option>
                                    <option value="60">60 seconds</option>
                                    <option value="120">2 minutes</option>
                                    <option value="300">5 minutes</option>
                                </select>
                            </div>
                            <div className="ai-chat-option-group">
                                <label>🔄 Loop:</label>
                                <select 
                                    id="template-looping" 
                                    onchange={(e) => selectedLooping = (e.target as HTMLSelectElement).value === 'true'}
                                    value={selectedLooping.toString()}
                                >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="ai-chat-header-controls">
                        <button 
                            className="ai-chat-close"
                            onclick={toggleChat}
                            title="Close Chat"
                        >
                            <Icon symbol={IconSymbol.Close} style={{width: '16px', height: '16px'}}/>
                        </button>
                    </div>
                </div>
                
                <div className="ai-chat-messages">
                    <div className="ai-chat-message ai-chat-message-ai">
                        <div className="ai-chat-avatar">AI</div>
                        <div className="ai-chat-content">
                            <p>Hello! I'm here to help you with your music production. What would you like to know?</p>
                        </div>
                    </div>
                    
                    {/* AI Assistant Suggestions */}
                    <div className="ai-chat-suggestions">
                        <h4>🎵 Quick Start Suggestions</h4>
                        <div className="ai-chat-suggestion-grid">
                            <button 
                                className="ai-chat-suggestion-btn"
                                onclick={() => {
                                    const input = document.querySelector('.ai-chat-text-input') as HTMLInputElement
                                    if (input) {
                                        input.value = "Create an upbeat, joyful pop track with catchy melodies for lively, happy content."
                                        input.focus()
                                    }
                                }}
                            >
                                <span className="suggestion-icon">🎉</span>
                                <span className="suggestion-text">Upbeat Pop Track</span>
                            </button>
                            
                            <button 
                                className="ai-chat-suggestion-btn"
                                onclick={() => {
                                    const input = document.querySelector('.ai-chat-text-input') as HTMLInputElement
                                    if (input) {
                                        input.value = "Make a warm, gentle, nostalgic, and emotional track for reflective moments."
                                        input.focus()
                                    }
                                }}
                            >
                                <span className="suggestion-icon">🌅</span>
                                <span className="suggestion-text">Warm & Nostalgic</span>
                            </button>
                            
                            <button 
                                className="ai-chat-suggestion-btn"
                                onclick={() => {
                                    const input = document.querySelector('.ai-chat-text-input') as HTMLInputElement
                                    if (input) {
                                        input.value = "Generate a high-energy, rhythmic, and uplifting track for energetic, exciting movie scenes."
                                        input.focus()
                                    }
                                }}
                            >
                                <span className="suggestion-icon">⚡</span>
                                <span className="suggestion-text">High-Energy Movie</span>
                            </button>
                            
                            <button 
                                className="ai-chat-suggestion-btn"
                                onclick={() => {
                                    const input = document.querySelector('.ai-chat-text-input') as HTMLInputElement
                                    if (input) {
                                        input.value = "Compose a smooth, mellow, chilled track perfect for study or relaxation."
                                        input.focus()
                                    }
                                }}
                            >
                                <span className="suggestion-icon">🧘</span>
                                <span className="suggestion-text">Chilled Study</span>
                            </button>
                            
                            <button 
                                className="ai-chat-suggestion-btn"
                                onclick={() => {
                                    const input = document.querySelector('.ai-chat-text-input') as HTMLInputElement
                                    if (input) {
                                        input.value = "Produce an epic, emotional track with a dramatic build-up for cinematic or storytelling use."
                                        input.focus()
                                    }
                                }}
                            >
                                <span className="suggestion-icon">🎬</span>
                                <span className="suggestion-text">Epic Cinematic</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Template Selection Menu */}
                <div className="ai-chat-template-menu" style={{display: isOpen ? 'block' : 'none'}}>
                    <div className="template-menu-header">
                        <h4>🎵 Create Template</h4>
                        <p>Choose your preferences, then type your custom prompt below</p>
                    </div>
                    
                    <div className="template-options">
                        <div className="template-option-group">
                            <label>🎨 Genre:</label>
                            <select id="template-genre" onchange={(e) => selectedGenre = (e.target as HTMLSelectElement).value}>
                                <option value="pop">Pop</option>
                                <option value="electronic">Electronic</option>
                                <option value="cinematic">Cinematic</option>
                                <option value="ambient">Ambient</option>
                                <option value="jazz">Jazz</option>
                                <option value="classical">Classical</option>
                                <option value="hip-hop">Hip-hop/Urban</option>
                                <option value="folk">Acoustic/Folk</option>
                                <option value="chiptune">8-bit/Chiptune</option>
                                <option value="rock">Rock</option>
                                <option value="world">World/Ethnic</option>
                                <option value="blues">Blues</option>
                            </select>
                        </div>
                        
                        <div className="template-option-group">
                            <label>🌅 Mood:</label>
                            <select id="template-mood" onchange={(e) => selectedMood = (e.target as HTMLSelectElement).value}>
                                <option value="calm">Calm</option>
                                <option value="happy">Happy</option>
                                <option value="sad">Sad</option>
                                <option value="energetic">Energetic</option>
                                <option value="relaxing">Relaxing</option>
                                <option value="romantic">Romantic</option>
                                <option value="uplifting">Uplifting</option>
                                <option value="melancholic">Melancholic</option>
                                <option value="motivational">Motivational</option>
                                <option value="mysterious">Mysterious</option>
                                <option value="nostalgic">Nostalgic</option>
                                <option value="dramatic">Dramatic</option>
                            </select>
                        </div>
                        
                        <div className="template-option-group">
                            <label>🎭 Style:</label>
                            <select id="template-style" onchange={(e) => selectedStyle = (e.target as HTMLSelectElement).value}>
                                <option value="cinematic">Cinematic</option>
                                <option value="chill">Chill</option>
                                <option value="ambient">Ambient</option>
                                <option value="upbeat">Upbeat</option>
                                <option value="lo-fi">Lo-fi</option>
                                <option value="corporate">Corporate</option>
                                <option value="funky">Funky</option>
                                <option value="vintage">Vintage</option>
                                <option value="epic">Epic</option>
                                <option value="groovy">Groovy</option>
                                <option value="dark">Dark</option>
                                <option value="bright">Bright</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="template-preview">
                        <span className="template-preview-label">Preview:</span>
                        <span className="template-preview-text" id="template-preview-text">
                            {selectedGenre} • {selectedMood} • {selectedStyle}
                        </span>
                    </div>
                </div>
                
                <div className="ai-chat-input">
                    <input 
                        type="text" 
                        placeholder="Type your custom template prompt here..."
                        className="ai-chat-text-input"
                        onkeypress={handleKeyPress}
                        oninput={() => {
                            updateTemplatePreview()
                        }}
                    />
                    <button className="ai-chat-send" onclick={sendMessage}>
                        <Icon symbol={IconSymbol.Play} style={{width: '16px', height: '16px'}}/>
                    </button>
                </div>
            </div>
        </Frag>
    )
}
