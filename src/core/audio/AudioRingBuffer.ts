import { AUDIO_CONSTANTS } from '../../config';

/**
 * Ring buffer implementation for efficient audio data management
 * Prevents memory leaks by limiting buffer size
 */
export class AudioRingBuffer {
    private buffer: Float32Array;
    private writePos: number = 0;
    private readPos: number = 0;
    private maxSamples: number;
    private filled: boolean = false;

    constructor(maxDurationSeconds: number = AUDIO_CONSTANTS.DEFAULT_RING_BUFFER_SECONDS, sampleRate: number = AUDIO_CONSTANTS.SAMPLE_RATE) {
        // Limit to maximum duration to prevent excessive memory usage
        const maxAllowedSeconds = AUDIO_CONSTANTS.MAX_RECORDING_SECONDS;
        const maxAllowedSamples = maxAllowedSeconds * sampleRate;
        this.maxSamples = Math.min(maxDurationSeconds * sampleRate, maxAllowedSamples);
        this.buffer = new Float32Array(this.maxSamples);
    }

    /**
     * Write audio data to the ring buffer
     */
    write(data: Float32Array): void {
        const dataLength = data.length;

        // If data is larger than buffer, only keep the latest samples
        if (dataLength >= this.maxSamples) {
            this.buffer.set(data.slice(dataLength - this.maxSamples));
            this.writePos = 0;
            this.readPos = 0;
            this.filled = true;
            return;
        }

        // Calculate available space
        const remainingSpace = this.maxSamples - this.writePos;

        if (dataLength <= remainingSpace) {
            // Data fits in remaining space
            this.buffer.set(data, this.writePos);
            this.writePos += dataLength;
        } else {
            // Data wraps around
            this.buffer.set(data.slice(0, remainingSpace), this.writePos);
            this.buffer.set(data.slice(remainingSpace), 0);
            this.writePos = dataLength - remainingSpace;
            this.filled = true;
        }

        // Update read position if we've wrapped around
        if (this.filled && this.writePos >= this.readPos) {
            this.readPos = this.writePos;
        }
    }

    /**
     * Read all available data from the buffer
     */
    read(): Float32Array {
        const availableSamples = this.getAvailableSamples();
        if (availableSamples === 0) {
            return new Float32Array(0);
        }

        const result = new Float32Array(availableSamples);

        if (this.filled) {
            // Buffer has wrapped, read from readPos to end, then from start to writePos
            const endSamples = this.maxSamples - this.readPos;
            result.set(this.buffer.slice(this.readPos, this.maxSamples), 0);
            result.set(this.buffer.slice(0, this.writePos), endSamples);
        } else {
            // Buffer hasn't wrapped, simple read
            result.set(this.buffer.slice(0, this.writePos), 0);
        }

        // Reset after reading
        this.clear();

        return result;
    }

    /**
     * Get the number of available samples
     */
    getAvailableSamples(): number {
        if (!this.filled) {
            return this.writePos;
        }
        return this.maxSamples;
    }

    /**
     * Clear the buffer
     */
    clear(): void {
        this.writePos = 0;
        this.readPos = 0;
        this.filled = false;
    }

    /**
     * Get buffer statistics
     */
    getStats(): { used: number; total: number; percentage: number } {
        const used = this.getAvailableSamples();
        const total = this.maxSamples;
        const percentage = (used / total) * 100;

        return { used, total, percentage };
    }
}
