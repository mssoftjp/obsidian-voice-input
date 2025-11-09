/**
 * AudioWorklet source code as a string
 * This allows us to create a blob URL for loading in restricted environments
 */

export const AUDIO_WORKLET_SOURCE = `
// AudioWorkletProcessor for real-time audio processing
class AudioProcessorWorklet extends AudioWorkletProcessor {
    constructor() {
        super();

        this.bufferSize = 4096;
        this.audioBuffer = [];
        this.isRecording = false;

        // Listen for messages from main thread
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }

    /**
     * Handle messages from main thread
     */
    handleMessage(data) {
        switch (data.type) {
            case 'start':
                this.isRecording = true;
                this.audioBuffer = [];
                break;

            case 'stop':
                this.isRecording = false;
                // Send any remaining buffered audio
                if (this.audioBuffer.length > 0) {
                    this.sendAudioData();
                }
                break;

            case 'configure':
                if (data.bufferSize) {
                    this.bufferSize = data.bufferSize;
                }
                break;
        }
    }

    /**
     * Process audio - called for each render quantum (128 samples)
     */
    process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (!this.isRecording || !input || input.length === 0) {
            return true; // Keep processor alive
        }

        // Get the first channel
        const channelData = input[0];
        if (!channelData || channelData.length === 0) {
            return true;
        }

        // Buffer the audio data
        this.audioBuffer.push(new Float32Array(channelData));

        // Check if we've accumulated enough data
        const totalSamples = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
        if (totalSamples >= this.bufferSize) {
            this.sendAudioData();
        }

        return true; // Keep processor alive
    }

    /**
     * Send accumulated audio data to main thread
     */
    sendAudioData() {
        if (this.audioBuffer.length === 0) {
            return;
        }

        // Combine all buffers into one
        const totalLength = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
        const combinedBuffer = new Float32Array(totalLength);

        let offset = 0;
        for (const buffer of this.audioBuffer) {
            combinedBuffer.set(buffer, offset);
            offset += buffer.length;
        }

        // Send to main thread
        this.port.postMessage({
            type: 'audio',
            data: combinedBuffer,
            timestamp: currentTime
        });

        // Clear the buffer
        this.audioBuffer = [];
    }
}

// Register the processor
registerProcessor('audio-processor-worklet', AudioProcessorWorklet);
`;

/**
 * Create a blob URL for the AudioWorklet
 */
export function createAudioWorkletBlobURL(): string {
    const blob = new Blob([AUDIO_WORKLET_SOURCE], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}

/**
 * Clean up blob URL when no longer needed
 */
export function revokeAudioWorkletBlobURL(url: string): void {
    URL.revokeObjectURL(url);
}
