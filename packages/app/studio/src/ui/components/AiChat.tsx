import {createElement, Frag} from "@opendaw/lib-jsx"
import {Icon} from "./Icon.tsx"
import {IconSymbol} from "@opendaw/studio-adapters"
import {Lifecycle, Terminator} from "@opendaw/lib-std"
import {Events} from "@opendaw/lib-dom"
import {GroqService, ChatMessage, AudioEffectControl, TimelineControl, SampleControl} from "@/service/GroqService"
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
    
    const toggleChat = () => {
        isOpen = !isOpen
        updateChatVisibility()
        
        // Start/stop BPM display updates
        if (isOpen) {
            // Update BPM display immediately
            updateBpmDisplay()
            
            // Update BPM display every 2 seconds while chat is open
            const bpmInterval = setInterval(updateBpmDisplay, 2000)
            
            // Store interval ID to clear it later
            terminator.own({
                terminate: () => clearInterval(bpmInterval)
            })
        }
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
    
    const updateBpmDisplay = () => {
        if (groqService) {
            const currentBpm = groqService.getCurrentBpm()
            const bpmElement = document.getElementById('current-bpm')
            if (bpmElement) {
                bpmElement.textContent = currentBpm.toString()
            }
        }
    }
    
    const testBpmChange = async () => {
        if (!groqService) {
            const project = service.project
            groqService = new GroqService(project)
        }
        
        addMessage('user', '🧪 Testing BPM change to 140')
        addMessage('assistant', '🤔 Testing...')
        
        try {
            const currentBpm = groqService.getCurrentBpm()
            await groqService.testBpmChange()
            const newBpm = groqService.getCurrentBpm()
            
            messages.pop() // Remove testing message
            addMessage('assistant', `🧪 Test completed! BPM changed from ${currentBpm} to ${newBpm}. Check console for details.`)
            
            // Update the BPM display
            updateBpmDisplay()
        } catch (error) {
            messages.pop() // Remove testing message
            addMessage('assistant', '❌ Test failed. Check console for errors.')
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
            
            // Process the message
            const control = await groqService.processRequest(userMessage)
            
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
                    // Regular chat response
                    const response = await groqService.sendMessage(userMessage)
                    messages.pop() // Remove typing indicator
                    addMessage('assistant', response)
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
                <Icon symbol={IconSymbol.Help} style={{width: '20px', height: '20px'}}/>
            </button>

            {/* Chat Panel - Slides up from bottom when open */}
            <div className="ai-chat-panel" style={{display: 'none'}}>
                <div className="ai-chat-header">
                    <div className="ai-chat-header-main">
                        <h3>AI Assistant</h3>
                        <div className="ai-chat-bpm-display">
                            🎵 BPM: <span id="current-bpm">--</span>
                        </div>
                    </div>
                    <div className="ai-chat-header-controls">
                        <button 
                            className="ai-chat-test"
                            onclick={() => testBpmChange()}
                            title="Test BPM Change"
                        >
                            🧪 Test
                        </button>
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
                
                <div className="ai-chat-input">
                    <input 
                        type="text" 
                        placeholder="Ask me anything about music production..."
                        className="ai-chat-text-input"
                        onkeypress={handleKeyPress}
                    />
                    <button className="ai-chat-send" onclick={sendMessage}>
                        <Icon symbol={IconSymbol.Play} style={{width: '16px', height: '16px'}}/>
                    </button>
                </div>
            </div>
        </Frag>
    )
}
