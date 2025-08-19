# AI Chat Feature for openDAW

## Overview
The AI Chat feature integrates Groq AI to provide intelligent assistance for music production in openDAW. It can answer questions about music production and automatically control audio effects like reverb and delay.

## Features

### 🤖 AI Assistant
- **Music Production Help**: Ask questions about music production, mixing, and mastering
- **Effect Control**: Automatically adjust reverb and delay parameters based on your requests
- **Real-time Responses**: Powered by Groq's Llama3-8b model for fast, intelligent responses

### 🎛️ Audio Effect Control
The AI can automatically control these parameters:

#### Reverb Parameters
- **decay**: 0.0 to 1.0 (reverb tail length)
- **preDelay**: 0.0 to 1.0 (time before reverb starts)
- **damp**: 0.0 to 1.0 (high frequency damping)
- **filter**: 0.0 to 1.0 (low pass filter)
- **wet**: -60 to 0 dB (reverb signal level)
- **dry**: -60 to 0 dB (dry signal level)

#### Delay Parameters
- **delay**: 0.0 to 1.0 (delay time)
- **feedback**: 0.0 to 1.0 (echo repetition)
- **cross**: 0.0 to 1.0 (stereo crossfeed)
- **filter**: 0.0 to 1.0 (low pass filter)
- **wet**: -60 to 0 dB (delay signal level)
- **dry**: -60 to 0 dB (dry signal level)

### 🎵 Timeline Control
The AI can automatically control these timeline settings:

#### BPM (Tempo) Control
- **BPM**: 30 to 1000 beats per minute
- Automatically clamps values to valid range
- Real-time tempo changes

#### Time Signature Control
- **Nominator**: 1 to 32 beats per measure
- **Denominator**: 1 to 32 (note value)
- Supports common signatures like 4/4, 3/4, 6/8, etc.

### 🎵 Sample Management
The AI can add samples to your project:

#### Sample Addition
- **"Add a sample"** → Adds a random sample to your project
- **"Add some audio"** → Adds a random audio sample
- **"Add a sound"** → Adds a random sound sample
- Creates new audio tracks automatically
- Samples appear in the timeline immediately

## How to Use

### 1. Access the Chat
- Look for the blue chat button in the bottom-right corner of the screen
- Click it to open the AI chat panel

### 2. Ask Questions
You can ask general music production questions like:
- "How do I create a warm vocal sound?"
- "What's the best way to mix drums?"
- "How can I make my bass sound fuller?"

### 3. Control Audio Effects
Ask the AI to adjust your effects:
- "Make the reverb more spacious with longer decay"
- "Add some delay with 30% feedback"
- "Reduce the wet level on my reverb to -12dB"
- "Make the delay more subtle with lower feedback"

### 4. Control Timeline Settings
Ask the AI to adjust BPM and time signature:
- "Change the BPM to 140 for a faster dance track"
- "Set the time signature to 3/4 for a waltz feel"
- "Increase the tempo to 180 BPM"
- "Change to 6/8 time signature for a folk song"

### 5. View Changes
- The AI will show you what parameters it changed
- Changes are applied in real-time to your project
- You'll see a confirmation message with the new values
- **Visual notifications** appear on the right side of the screen
- **Animated chat messages** highlight the changes made

## Examples

### Reverb Control
**You**: "Make the reverb more atmospheric with longer decay"
**AI**: "I'll increase the decay to 0.8 for a longer, more atmospheric reverb tail. This will create a more spacious, ambient sound that's great for atmospheric tracks."

**Result**: `✅ Applied reverb changes: decay: 0.8`

### Delay Control
**You**: "Add some stereo delay with 40% feedback"
**AI**: "I'll set the delay to 0.3 seconds with 40% feedback and add some stereo crossfeed for a wider, more interesting delay effect."

**Result**: `🎛️ Applied delay changes: delay: 0.3, feedback: 0.4, cross: 0.2`

### Timeline Control
**You**: "Change the BPM to 140 for a faster dance track"
**AI**: "I'll increase the BPM to 140 for a faster, more energetic dance track. This will make your track feel more upbeat and suitable for dancing."

**Result**: `🎵 Applied bpm changes: bpm: 140`

**You**: "Set the time signature to 3/4 for a waltz feel"
**AI**: "I'll change the time signature to 3/4, which will give your track a classic waltz rhythm with three beats per measure."

**Result**: `🎵 Applied signature changes: nominator: 3, denominator: 4`

### Sample Addition
**You**: "Add a sample to my project"
**AI**: "I'll add a random sample to your project! This will create a new audio track that you can use in your music."

**Result**: `🎵 Added sample to your project! Check the timeline for the new audio track.`

## Technical Details

- **API**: Uses Groq's Llama3-8b model for fast responses
- **Integration**: Directly controls openDAW's audio effect parameters
- **Real-time**: Changes are applied immediately to your project
- **Error Handling**: Graceful fallback if effects aren't found or errors occur

## Requirements

- Active internet connection for Groq API access
- Reverb or delay devices in your project for effect control
- The AI will inform you if no effects are found

## Tips

1. **Be Specific**: Instead of "make it better," try "increase the decay to 0.7"
2. **Use Musical Terms**: The AI understands musical concepts and can translate them to parameters
3. **Experiment**: Ask the AI to try different settings and see what works best
4. **Save Your Work**: Always save your project after making changes

## Troubleshooting

- **No Effects Found**: Make sure you have reverb or delay devices in your project
- **API Errors**: Check your internet connection and try again
- **Parameter Issues**: The AI will inform you if a parameter value is out of range

## Privacy

- All conversations are processed through Groq's secure API
- No audio data is sent to external services
- Only text messages are processed for AI responses

## Configuration

### Setting Up Your Groq API Key

1. **Create a `.env` file** in the `packages/app/studio/` directory
2. **Add your API key**:
   ```
   VITE_GROQ_API_KEY=your-actual-groq-api-key-here
   ```
3. **Restart the application** for changes to take effect

### Example .env File
```
VITE_GROQ_API_KEY=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
```

### Security Notes
- **Never commit your `.env` file** to version control
- **Keep your API key private** and secure
- **Use environment variables** for all sensitive configuration
- The `.env.example` file shows the required format without exposing actual keys
