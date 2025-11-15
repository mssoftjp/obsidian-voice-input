import { VISUALIZATION_CONSTANTS } from '../../config';
import { Disposable } from '../../interfaces';

export class AudioVisualizer extends Disposable {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private isRecording: boolean = false;
    private animationId: number | null = null;
    private vadStatus: 'silence' | 'speech' = 'silence';
    private vadThreshold: number = VISUALIZATION_CONSTANTS.DEFAULT_VAD_THRESHOLD;
    private currentLevel: number = 0;
    private waveformHistory: number[] = []; // 時系列波形データ
    private maxHistoryLength: number = VISUALIZATION_CONSTANTS.MAX_HISTORY_LENGTH;

    constructor(container: HTMLElement) {
        super();
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'voice-input-audio-visualizer-canvas';
        this.canvas.width = 200;
        this.canvas.height = 56;
        container.appendChild(this.canvas);

        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get canvas context');
        }
        this.ctx = context;

        this.drawEmptyGraph();
    }

    connect(analyser: AnalyserNode): void {
        this.analyser = analyser;
        this.analyser.fftSize = 2048;
        const bufferLength = this.analyser.fftSize;
        this.dataArray = new Uint8Array(bufferLength);
    }

    start(): void {
        this.isRecording = true;
        this.draw();
    }

    stop(): void {
        this.isRecording = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.clear();
    }

    setVADStatus(status: 'silence' | 'speech'): void {
        this.vadStatus = status;
    }

    setVADThreshold(threshold: number): void {
        this.vadThreshold = threshold;
    }

    private draw(): void {
        if (!this.isRecording || !this.analyser || !this.dataArray) {
            return;
        }

        this.animationId = requestAnimationFrame(() => this.draw());

        // Get time domain data (waveform)
        const waveformArray = this.dataArray as Uint8Array<ArrayBuffer>;
        this.analyser.getByteTimeDomainData(waveformArray);

        // Calculate RMS (Root Mean Square) for current audio level
        let sum = 0;
        for (let i = 0; i < waveformArray.length; i++) {
            const normalized = (waveformArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / waveformArray.length);
        this.currentLevel = rms;

        // Apply scaling factor to make waveform more visible
        // RMS values are typically 0.0-0.3, so scale up by 3-5x
        const scalingFactor = 4.0;
        const scaledRms = Math.min(rms * scalingFactor, 1.0); // Cap at 1.0

        // Add to history
        this.waveformHistory.push(scaledRms);
        if (this.waveformHistory.length > this.maxHistoryLength) {
            this.waveformHistory.shift();
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw waveform
        this.drawWaveform();

        // Draw center line
        this.drawCenterLine();
    }

    private drawWaveform(): void {
        if (this.waveformHistory.length < 2) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;
        const maxAmplitude = height / 2 - 2;

        // Determine if current level is above threshold
        const isAboveThreshold = this.currentLevel > this.vadThreshold;

        // Set stroke style
        this.ctx.strokeStyle = isAboveThreshold ? '#40c057' : '#868e96';
        this.ctx.lineWidth = 2;

        // Draw positive waveform
        this.drawWaveformPath(width, centerY, maxAmplitude, false);
        this.ctx.stroke();

        // Draw negative waveform (mirror)
        this.drawWaveformPath(width, centerY, maxAmplitude, true);
        this.ctx.stroke();

        // Fill area if above threshold
        if (isAboveThreshold) {
            this.ctx.fillStyle = 'rgba(64, 192, 87, 0.1)';
            this.drawWaveformPath(width, centerY, maxAmplitude, false);
            // Complete the path
            for (let i = this.waveformHistory.length - 1; i >= 0; i--) {
                const x = (i / (this.maxHistoryLength - 1)) * width;
                const amplitude = this.waveformHistory[i] * maxAmplitude;
                const y = centerY + amplitude;
                this.ctx.lineTo(x, y);
            }
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    private drawCenterLine(): void {
        const centerY = this.canvas.height / 2;

        this.ctx.strokeStyle = '#dee2e6';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    }
    /**
     * Draw waveform path
     */
    private drawWaveformPath(width: number, centerY: number, maxAmplitude: number, isMirrored: boolean): void {
        this.ctx.beginPath();
        for (let i = 0; i < this.waveformHistory.length; i++) {
            const x = (i / (this.maxHistoryLength - 1)) * width;
            const amplitude = this.waveformHistory[i] * maxAmplitude;
            const y = centerY + (isMirrored ? amplitude : -amplitude);

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
    }

    private clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.waveformHistory = []; // 波形履歴もクリア
        this.drawEmptyGraph();
    }

    private drawEmptyGraph(): void {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw center line
        this.drawCenterLine();

        // Draw flat waveform line
        const centerY = this.canvas.height / 2;
        this.ctx.strokeStyle = '#868e96';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();
    }

    /**
     * Disposableパターンの実装
     */
    protected onDispose(): void {
        this.stop();
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    /**
     * 互換性のためのdestroyメソッド
     * @deprecated dispose()を使用してください
     */
    destroy(): void {
        this.dispose();
    }
}

export class SimpleAudioLevelIndicator extends Disposable {
    private container: HTMLElement;
    private levelBar: HTMLElement;
    private vadIndicator: HTMLElement;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private animationId: number | null = null;
    private isActive: boolean = false;

    constructor(container: HTMLElement) {
        super();
        this.container = container;
        this.createUI();
    }

    private createUI(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'voice-input-audio-level-indicator';

        // Level bar
        const levelContainer = document.createElement('div');
        levelContainer.className = 'voice-input-audio-level-container';

        this.levelBar = document.createElement('div');
        this.levelBar.className = 'voice-input-audio-level-bar';

        levelContainer.appendChild(this.levelBar);

        // VAD indicator
        this.vadIndicator = document.createElement('div');
        this.vadIndicator.className = 'voice-input-audio-vad-indicator';

        wrapper.appendChild(levelContainer);
        wrapper.appendChild(this.vadIndicator);
        this.container.appendChild(wrapper);
    }

    connect(analyser: AnalyserNode): void {
        this.analyser = analyser;
        this.analyser.fftSize = 256;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    start(): void {
        this.isActive = true;
        this.update();
    }

    stop(): void {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.setLevelBarClass(0);
    }

    setVADStatus(status: 'silence' | 'speech'): void {
        if (status === 'speech') {
            this.vadIndicator.classList.add('speech');
        } else {
            this.vadIndicator.classList.remove('speech');
        }
    }

    private update(): void {
        if (!this.isActive || !this.analyser || !this.dataArray) {
            return;
        }

        this.animationId = requestAnimationFrame(() => this.update());

        const frequencyArray = this.dataArray as Uint8Array<ArrayBuffer>;
        this.analyser.getByteFrequencyData(frequencyArray);

        // Calculate average level with emphasis on lower frequencies (voice range)
        let sum = 0;
        const relevantBins = Math.min(frequencyArray.length / 4, 50); // Focus on voice frequencies
        for (let i = 0; i < relevantBins; i++) {
            sum += frequencyArray[i];
        }
        const average = sum / relevantBins;
        // Apply scaling for better visibility
        const percentage = Math.min((average / 128) * 100, 100);

        this.setLevelBarClass(percentage);
    }

    private setLevelBarClass(percentage: number): void {
        // Add active class for theme compatibility and set CSS custom property
        this.levelBar.classList.add('active');
        this.levelBar.style.setProperty('--audio-level-width', `${Math.round(percentage)}%`);
    }

    protected onDispose(): void {
        this.stop();
        this.container.empty();
    }

    destroy(): void {
        this.dispose();
    }
}
