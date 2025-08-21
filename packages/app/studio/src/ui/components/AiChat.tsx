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
                // Prepend the selected template preferences to the user's message
                messageToProcess = `Create a ${selectedStyle} ${selectedMood} ${selectedGenre} template: ${userMessage}`
                console.log('🎵 Enhanced template request:', messageToProcess)
                
                // For templates, show thinking process immediately and then stream the response
                messages.pop() // Remove typing indicator
                const assistantIndex = messages.length
                messages.push({ role: 'assistant', content: '', timestamp: new Date() })
                updateMessagesDisplay()
                
                // Show template details immediately
                const templateDetails = `🎵 I'll create a ${selectedStyle} ${selectedMood} ${selectedGenre} track for you!\n\n🎵 Starting composition now...`
                
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
                    addMessage('assistant', `🎵 Composing your ${selectedStyle} ${selectedMood} ${selectedGenre} track...`)
                    const control = await groqService.processRequest(messageToProcess)
                    if (control && 'type' in control && control.type === 'create_template') {
                        addMessage('assistant', '🎵 Beatoven is working on your track! This will take a few minutes.')
                        
                        // Add completion message after delay
                        setTimeout(() => {
                            addMessage('assistant', `🎵 Your ${selectedStyle} ${selectedMood} ${selectedGenre} track is ready! Check your timeline for the new audio tracks.`)
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
