import { VADProcessor, VADSegment } from './VADProcessor';
import { AudioVisualizer, SimpleAudioLevelIndicator } from './AudioVisualizer';
import { AudioRecorderOptions } from '../../interfaces';
import { TranscriptionError, TranscriptionErrorType } from '../../errors';
import { AudioRingBuffer } from './AudioRingBuffer';
import { createAudioWorkletBlobURL, revokeAudioWorkletBlobURL } from './AudioWorkletSource';
import { AUDIO_CONSTANTS, DEFAULT_AUDIO_SETTINGS, DEFAULT_VAD_SETTINGS, VAD_CONSTANTS } from '../../config';
import { Disposable, CompositeDisposable } from '../../interfaces';
import { Logger } from '../../utils';
import { createServiceLogger } from '../../services';
import { WindowWithWebkitAudio, hasWebkitAudioContext } from '../../types';

export class AudioRecorder extends Disposable {
    private mediaRecorder: MediaRecorder | null = null;
    private audioContext: AudioContext | null = null;
    private analyserNode: AnalyserNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private gainNode: GainNode | null = null; // 音声増幅用
    private highPassFilter: BiquadFilterNode | null = null; // 80Hz HPF
    private lowPassFilter: BiquadFilterNode | null = null; // 7.6kHz LPF
    private workletNode: AudioWorkletNode | null = null;
    private vadProcessor: VADProcessor | null = null;
    private visualizer: AudioVisualizer | SimpleAudioLevelIndicator | null = null;
    private chunks: Blob[] = [];
    private isRecording: boolean = false;
    private stream: MediaStream | null = null;
    private options: AudioRecorderOptions;
    private silenceTimer: NodeJS.Timeout | null = null;
    private lastSpeechTime: number = 0;
    private continuousAudioData: Float32Array[] = [];
    private audioRingBuffer: AudioRingBuffer;
    private sampleRate: number = AUDIO_CONSTANTS.SAMPLE_RATE;
    private workletReady: boolean = false;
    private workletBlobURL: string | null = null;
    private microphoneReady: boolean = false;
    private audioDataReceived: boolean = false;
    private disposables: CompositeDisposable = new CompositeDisposable();
    private logger: Logger | null = null;
    private recordingStartTime: number = 0;
    private maxRecordingTimer: NodeJS.Timeout | null = null;
    private isStarting: boolean = false;

    constructor(options: AudioRecorderOptions) {
        super();
        this.options = options;
        
        // Loggerの遅延初期化（ServiceLocatorから取得）
        try {
            this.logger = createServiceLogger('AudioRecorder');
        } catch (error) {
            // ServiceLocatorがまだ初期化されていない場合は後で初期化
            this.logger = null;
        }
        
        // 型ガードでVADの使用を判定
        if (options.useVAD) {
            // TypeScriptの型推論により、ここではoptions.appが必須であることが保証される
            this.vadProcessor = new VADProcessor(options.app, {
                vadMode: options.vadMode || DEFAULT_VAD_SETTINGS.mode,
                minSpeechDuration: options.minSpeechDuration || DEFAULT_VAD_SETTINGS.minSpeechDuration,
                minSilenceDuration: options.minSilenceDuration || DEFAULT_VAD_SETTINGS.minSilenceDuration,
                speechPadding: DEFAULT_VAD_SETTINGS.speechPadding
            });
        }
        // VADを使用しない場合は、vadProcessorはnullのまま
        
        // Initialize ring buffer with max recording duration
        const maxSeconds = this.options.maxRecordingSeconds || AUDIO_CONSTANTS.MAX_RECORDING_SECONDS;
        this.audioRingBuffer = new AudioRingBuffer(maxSeconds, this.sampleRate);
    }

    async initialize(): Promise<void> {
        this.throwIfDisposed();
        
        // 既にAudioContextが有効なら再初期化はスキップ
        if (this.audioContext && this.audioContext.state !== 'closed') {
            // まだビジュアライザー未生成ならここで生成
            if (!this.visualizer && this.options.visualizerContainer) {
                this.visualizer = this.options.useSimpleVisualizer
                    ? new SimpleAudioLevelIndicator(this.options.visualizerContainer)
                    : new AudioVisualizer(this.options.visualizerContainer);
            }
            return;
        }

        if (this.options.useVAD && this.vadProcessor) {
            await this.vadProcessor.initialize();
        }
        
        // Create audio context with configured sample rate and low latency hint
        const WindowWithWebkit = window as WindowWithWebkitAudio;
        const AudioContextConstructor = window.AudioContext || WindowWithWebkit.webkitAudioContext;
        
        if (!AudioContextConstructor) {
            throw new TranscriptionError(
                TranscriptionErrorType.AUDIO_INITIALIZATION_FAILED,
                'AudioContext is not supported in this browser'
            );
        }

        this.audioContext = new AudioContextConstructor({ 
            sampleRate: AUDIO_CONSTANTS.SAMPLE_RATE,
            latencyHint: AUDIO_CONSTANTS.LATENCY_HINT // Low latency mode for faster initialization
        });
        this.sampleRate = this.audioContext.sampleRate;

        // Try to use AudioWorklet with blob URL
        if (this.audioContext.audioWorklet) {
            try {
                // Create blob URL for AudioWorklet
                this.workletBlobURL = createAudioWorkletBlobURL();
                await this.audioContext.audioWorklet.addModule(this.workletBlobURL);
                this.workletReady = true;
                this.logger?.info('AudioWorklet initialized successfully using blob URL');
            } catch (error) {
                this.logger?.info('AudioWorklet not available, using ScriptProcessor fallback');
                this.workletReady = false;
                // Clean up blob URL if it was created
                if (this.workletBlobURL) {
                    revokeAudioWorkletBlobURL(this.workletBlobURL);
                    this.workletBlobURL = null;
                }
            }
        } else {
            // AudioWorklet not supported
            this.workletReady = false;
        }

        // Create visualizer if container provided
        if (this.options.visualizerContainer) {
            if (this.options.useSimpleVisualizer) {
                this.visualizer = new SimpleAudioLevelIndicator(this.options.visualizerContainer);
            } else {
                this.visualizer = new AudioVisualizer(this.options.visualizerContainer);
            }
        }
        
    }

    async startRecording(): Promise<void> {
        this.throwIfDisposed();
        if (this.isRecording || this.isStarting) {
            return;
        }
        this.isStarting = true;

        try {
            // Ensure AudioContext exists (防御的)
            if (!this.audioContext || this.audioContext.state === 'closed') {
                await this.initialize();
            }
            // Safariなどでのsuspend対策
            if (this.audioContext!.state === 'suspended') {
                await this.audioContext!.resume();
            }

            // Log recording session start
            this.logger?.info('Starting recording session', {
                sampleRate: AUDIO_CONSTANTS.SAMPLE_RATE,
                channelCount: DEFAULT_AUDIO_SETTINGS.channelCount,
                maxDuration: this.options.maxRecordingSeconds || AUDIO_CONSTANTS.MAX_RECORDING_SECONDS,
                vadEnabled: this.options.useVAD !== false,
                vadMode: this.options.useVAD !== false ? (this.options.vadMode || DEFAULT_VAD_SETTINGS.mode) : DEFAULT_VAD_SETTINGS.mode
            });

            // Notify initialization started
            if (this.options.onMicrophoneStatusChange) {
                this.options.onMicrophoneStatusChange('initializing');
            }
            
            // Get microphone access with optimized settings for transcription
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: AUDIO_CONSTANTS.SAMPLE_RATE,     // Optimal for speech recognition
                    channelCount: DEFAULT_AUDIO_SETTINGS.channelCount,  // Mono audio
                    echoCancellation: DEFAULT_AUDIO_SETTINGS.echoCancellation,
                    noiseSuppression: DEFAULT_AUDIO_SETTINGS.noiseSuppression,
                    autoGainControl: DEFAULT_AUDIO_SETTINGS.autoGainControl
                } 
            });

            // Monitor stream tracks for mute state
            const audioTrack = this.stream.getAudioTracks()[0];
            if (audioTrack) {
                // Check if track is initially muted (Windows often starts muted)
                if (audioTrack.muted) {
                    this.logger?.warn('Microphone track is muted, waiting for unmute...');
                }
                
                // Listen for mute state changes
                audioTrack.addEventListener('mute', () => {
                    this.logger?.debug('Microphone muted');
                    this.microphoneReady = false;
                });
                
                audioTrack.addEventListener('unmute', () => {
                    this.logger?.debug('Microphone unmuted');
                    if (!this.microphoneReady && this.audioDataReceived) {
                        this.microphoneReady = true;
                        if (this.options.onMicrophoneStatusChange) {
                            this.options.onMicrophoneStatusChange('ready');
                        }
                    }
                });
            }

            // Setup audio processing chain with filters
            if (!this.audioContext) {
                throw new TranscriptionError(
                    TranscriptionErrorType.AUDIO_INITIALIZATION_FAILED,
                    'Audio context is not initialized'
                );
            }
            this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
            this.gainNode = this.audioContext!.createGain();
            this.gainNode.gain.value = DEFAULT_AUDIO_SETTINGS.gain; // デフォルトゲイン
            
            // Create BiquadFilters for band-limiting
            this.highPassFilter = this.audioContext!.createBiquadFilter();
            this.highPassFilter.type = 'highpass';
            this.highPassFilter.frequency.value = AUDIO_CONSTANTS.FILTERS.HIGH_PASS_FREQ; // HPF - 低域ノイズ除去
            
            this.lowPassFilter = this.audioContext!.createBiquadFilter();
            this.lowPassFilter.type = 'lowpass';
            this.lowPassFilter.frequency.value = AUDIO_CONSTANTS.FILTERS.LOW_PASS_FREQ; // LPF - 音声帯域に制限
            
            this.analyserNode = this.audioContext!.createAnalyser();
            
            // Connect: source -> gain -> HPF -> LPF -> analyser
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.highPassFilter);
            this.highPassFilter.connect(this.lowPassFilter);
            this.lowPassFilter.connect(this.analyserNode);

            // Connect visualizer
            if (this.visualizer) {
                this.visualizer.connect(this.analyserNode);
                this.visualizer.start();
            }

            // Setup MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: AUDIO_CONSTANTS.WEBM_CODEC
            });

            this.chunks = [];
            this.continuousAudioData = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Set up maximum recording time limit
            const maxSeconds = this.options.maxRecordingSeconds || AUDIO_CONSTANTS.MAX_RECORDING_SECONDS;
            this.maxRecordingTimer = setTimeout(async () => {
                this.logger?.info(`Maximum recording time (${maxSeconds}s) reached, stopping recording`);
                const audioBlob = await this.stopRecording();
                if (audioBlob && this.options.onSpeechEnd) {
                    this.options.onSpeechEnd(audioBlob);
                }
            }, maxSeconds * 1000);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
            };

            this.mediaRecorder.start(AUDIO_CONSTANTS.RECORDER_TIMESLICE); // Collect data at configured interval

            // Start continuous audio processing for VAD
            this.startContinuousProcessing();
            
            this.logger?.debug('Recording started successfully', {
                mimeType: AUDIO_CONSTANTS.WEBM_CODEC,
                timeslice: AUDIO_CONSTANTS.RECORDER_TIMESLICE
            });

        } catch (error) {
            this.logger?.error('Failed to start recording', error);
            throw error;
        } finally {
            this.isStarting = false;
        }
    }

    private async startContinuousProcessing(): Promise<void> {
        if (!this.audioContext || !this.sourceNode) return;

        if (this.workletReady) {
            // Use AudioWorklet (preferred)
            try {
                this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor-worklet', {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    channelCount: 1
                });

                // Configure worklet
                this.workletNode.port.postMessage({
                    type: 'configure',
                    bufferSize: AUDIO_CONSTANTS.BUFFER_SIZE
                });

                // Start recording
                this.workletNode.port.postMessage({ type: 'start' });

                // Handle audio data from worklet
                this.workletNode.port.onmessage = async (event) => {
                    if (event.data.type === 'audio' && this.isRecording) {
                        await this.processAudioData(event.data.data);
                    }
                };

                // Connect nodes: lowPassFilter (end of chain) -> worklet
                this.lowPassFilter!.connect(this.workletNode);
                this.workletNode.connect(this.audioContext.destination);
            } catch (error) {
                this.logger?.warn('Failed to use AudioWorklet, falling back to ScriptProcessor', error);
                this.workletReady = false;
                this.startLegacyProcessing();
            }
        } else {
            // Fallback to ScriptProcessor
            this.startLegacyProcessing();
        }
    }

    private startLegacyProcessing(): void {
        if (!this.audioContext || !this.sourceNode) return;

        const bufferSize = AUDIO_CONSTANTS.BUFFER_SIZE;
        const scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        this.lowPassFilter!.connect(scriptProcessor);
        scriptProcessor.connect(this.audioContext.destination);

        scriptProcessor.onaudioprocess = async (event) => {
            if (!this.isRecording) return;

            const inputData = event.inputBuffer.getChannelData(0);
            const audioData = new Float32Array(inputData);
            await this.processAudioData(audioData);
        };
    }

    private async processAudioData(audioData: Float32Array): Promise<void> {
        // Early return if not recording to prevent unnecessary processing
        if (!this.isRecording) {
            return;
        }
        
        // Write to ring buffer to prevent unlimited memory growth
        this.audioRingBuffer.write(audioData);
        
        // Check for actual audio data to confirm microphone is working
        const audioLevel = Math.max(...audioData.map(Math.abs));
        
        // If we haven't marked microphone as ready yet, check for non-zero audio data
        if (!this.microphoneReady && audioLevel > AUDIO_CONSTANTS.MIC_DETECTION_THRESHOLD) {
            this.audioDataReceived = true;
            const audioTrack = this.stream?.getAudioTracks()[0];
            
            // Check if track is not muted and we have actual audio data
            if (audioTrack && !audioTrack.muted) {
                this.microphoneReady = true;
                this.logger?.info('Microphone is now ready - audio data detected');
                if (this.options.onMicrophoneStatusChange) {
                    this.options.onMicrophoneStatusChange('ready');
                }
            }
        }
        
        
        if (this.options.useVAD) {
            // VADモード: 音声区間を自動検出
            this.continuousAudioData.push(audioData);

            // Accumulate audio data for VAD processing
            if (this.continuousAudioData.length >= VAD_CONSTANTS.VAD_ACCUMULATION_THRESHOLD) { // Process when enough frames accumulated
                const combinedData = this.combineAudioData(this.continuousAudioData);
                this.continuousAudioData = [];
                

                // Process with VAD
                const segments = this.vadProcessor ? await this.vadProcessor.detectSpeechSegments(combinedData) : [];
                
                if (segments.length > 0) {
                    this.handleSpeechDetected();
                } else {
                    this.handleSilenceDetected();
                }
            }
        } else {
            // 連続録音モード: 常に録音中として扱う
            this.lastSpeechTime = Date.now();
        }

        // Log buffer usage periodically
        if (Math.random() < AUDIO_CONSTANTS.BUFFER_STATS_LOG_PROBABILITY) { // Log periodically
            const stats = this.audioRingBuffer.getStats();
            if (stats.percentage > AUDIO_CONSTANTS.BUFFER_WARNING_THRESHOLD) {
                this.logger?.warn(`Audio buffer usage high: ${stats.percentage.toFixed(1)}%`);
            }
        }
    }

    private combineAudioData(arrays: Float32Array[]): Float32Array {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Float32Array(totalLength);
        let offset = 0;
        
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        
        return result;
    }

    private handleSpeechDetected(): void {
        this.lastSpeechTime = Date.now();
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        if (this.visualizer) {
            this.visualizer.setVADStatus('speech');
        }

        if (this.options.useVAD) {
            this.options.onVADStatusChange('speech');
        }
    }

    private handleSilenceDetected(): void {
        if (this.visualizer) {
            this.visualizer.setVADStatus('silence');
        }

        if (this.options.useVAD) {
            this.options.onVADStatusChange('silence');
        }

        // Check if we should auto-stop due to silence (only in VAD mode)
        if (this.options.useVAD && this.lastSpeechTime > 0 && !this.silenceTimer) {
            this.silenceTimer = setTimeout(async () => {
                if (this.isRecording) {
                    const audioBlob = await this.stopRecording();
                    if (audioBlob && this.options.onSpeechEnd) {
                        this.options.onSpeechEnd(audioBlob);
                    }
                }
            }, this.options.useVAD ? this.options.autoStopSilenceDuration! : 0);
        }
    }

    async stopRecording(): Promise<Blob | null> {
        this.throwIfDisposed();
        if (!this.isRecording || !this.mediaRecorder) {
            return null;
        }
        
        // Clear maximum recording timer
        if (this.maxRecordingTimer) {
            clearTimeout(this.maxRecordingTimer);
            this.maxRecordingTimer = null;
        }
        
        // Log recording session end
        if (this.recordingStartTime) {
            const duration = (Date.now() - this.recordingStartTime) / 1000;
            this.logger?.info('Recording session ended', {
                duration: duration.toFixed(1),
                chunksCount: this.chunks.length,
                totalAudioData: this.continuousAudioData.length
            });
        }

        this.isRecording = false;

        return new Promise((resolve) => {
            this.mediaRecorder!.onstop = () => {
                const audioBlob = new Blob(this.chunks, { type: 'audio/webm' });
                
                this.cleanup();
                
                // Do not call onSpeechEnd here - it will be called by specific stop handlers
                
                resolve(audioBlob);
            };

            this.mediaRecorder!.stop();
        });
    }

    private cleanup(): void {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        if (this.maxRecordingTimer) {
            clearTimeout(this.maxRecordingTimer);
            this.maxRecordingTimer = null;
        }

        if (this.workletNode) {
            // Clear event handlers first
            if (this.workletNode.port) {
                this.workletNode.port.onmessage = null;
            }
            this.workletNode.port.postMessage({ type: 'stop' });
            this.workletNode.disconnect();
            this.workletNode = null;
        }

        if (this.visualizer) {
            this.visualizer.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }

        if (this.highPassFilter) {
            this.highPassFilter.disconnect();
            this.highPassFilter = null;
        }

        if (this.lowPassFilter) {
            this.lowPassFilter.disconnect();
            this.lowPassFilter = null;
        }

        if (this.analyserNode) {
            this.analyserNode.disconnect();
            this.analyserNode = null;
        }

        this.chunks = [];
        this.continuousAudioData = [];
        this.lastSpeechTime = 0;
        this.audioRingBuffer.clear();
        this.microphoneReady = false;
        this.audioDataReceived = false;
    }

    isActive(): boolean {
        return this.isRecording;
    }
    
    isMicrophoneReady(): boolean {
        return this.microphoneReady;
    }
    
    setAudioGain(gain: number): void {
        if (this.gainNode) {
            this.gainNode.gain.value = gain;
        }
    }

    /**
     * Disposableパターンの実装
     */
    protected onDispose(): void {
        this.cleanup();
        
        if (this.visualizer) {
            this.visualizer.destroy();
            this.visualizer = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Clean up blob URL
        if (this.workletBlobURL) {
            revokeAudioWorkletBlobURL(this.workletBlobURL);
            this.workletBlobURL = null;
        }

        if (this.vadProcessor) {
            this.vadProcessor.destroy();
            this.vadProcessor = null;
        }
        
        // Dispose all registered disposables
        this.disposables.dispose();
    }
    
    /**
     * 互換性のためのdestroyメソッド
     * @deprecated dispose()を使用してください
     */
    destroy(): void {
        this.dispose();
    }

    setAutoStopDuration(duration: number): void {
        if (this.options.useVAD) {
            this.options.autoStopSilenceDuration = duration;
        }
    }
}
