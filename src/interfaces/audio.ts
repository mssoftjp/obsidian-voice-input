import { App } from 'obsidian';

/**
 * 共通のオプション
 *
 * CLAUDE.mdの哲学に従った設計:
 * - 必須とオプションの明確な分離
 * - onSpeechEndはコア機能のため必須
 */
interface BaseAudioRecorderOptions {
    /** 音声録音が終了した際のコールバック（必須） */
    onSpeechEnd: (audioBlob: Blob) => void;

    /** マイクの状態変化を通知するコールバック */
    onMicrophoneStatusChange?: (status: 'initializing' | 'ready' | 'error') => void;

    /** ビジュアライザーを表示するコンテナ要素 */
    visualizerContainer?: HTMLElement;

    /** シンプルなレベルインジケーターを使用するか */
    useSimpleVisualizer?: boolean;

    /** 最大録音時間（秒） */
    maxRecordingSeconds?: number;
}

// VADを使用しない場合のオプション
export interface AudioRecorderOptionsWithoutVAD extends BaseAudioRecorderOptions {
    useVAD: false;
}

/**
 * VADを使用する場合のオプション
 *
 * CLAUDE.mdの哲学に従った設計:
 * - VAD使用時に必要なプロパティを必須化
 * - 型システムで安全性を保証
 */
export interface AudioRecorderOptionsWithVAD extends BaseAudioRecorderOptions {
    useVAD: true;

    /** Obsidian Appインスタンス（VAD使用時は必須） */
    app: App;

    /** VADの状態変化を通知するコールバック（VAD使用時は必須） */
    onVADStatusChange: (status: 'speech' | 'silence') => void;

    /** 無音継続時の自動停止時間 (ms) - デフォルト: 2000 */
    autoStopSilenceDuration?: number;

    /** VADモード (0-3: 0=低感度, 3=高感度) - デフォルト: 3 */
    vadMode?: 0 | 1 | 2 | 3;

    /** 最小音声継続時間 (ms) - デフォルト: 100 */
    minSpeechDuration?: number;

    /** エネルギー闾値 - デフォルト: 0.02 */
    energyThreshold?: number;

    /** 最小無音継続時間 (ms) - デフォルト: 1000 */
    minSilenceDuration?: number;
}

// ユニオン型で両方のケースを表現
export type AudioRecorderOptions = AudioRecorderOptionsWithoutVAD | AudioRecorderOptionsWithVAD;

export interface IAudioProcessor {
    initialize(): Promise<void>;
    process(data: Float32Array): Promise<ProcessedAudio>;
    destroy(): void;
}

export interface ProcessedAudio {
    data: Float32Array;
    isSpeech: boolean;
    timestamp: number;
}

export interface IAudioVisualizer {
    initialize(audioContext: AudioContext, source: MediaStreamAudioSourceNode): void;
    updateVADStatus(isActive: boolean): void;
    destroy(): void;
}

export interface IVADProcessor {
    initialize(sampleRate: number): Promise<void>;
    process(audioData: Float32Array): Promise<boolean>;
    destroy(): void;
}
