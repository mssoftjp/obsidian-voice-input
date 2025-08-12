/**
 * ユーザー設定のデフォルト値
 * これらの値はユーザーが設定画面から変更可能です
 */

/**
 * オーディオ設定のデフォルト値
 */
export const DEFAULT_AUDIO_SETTINGS = {
    /** 無音検出による自動停止までの時間 (ms) */
    autoStopSilenceDuration: 2000,

    /** オーディオゲイン */
    gain: 1.0,

    /** エコーキャンセレーション */
    echoCancellation: true,

    /** ノイズ抑制 */
    noiseSuppression: true,

    /** 自動ゲインコントロール */
    autoGainControl: true,

    /** チャンネル数 (モノラル) */
    channelCount: 1
} as const;

/**
 * VAD設定のデフォルト値
 */
export const DEFAULT_VAD_SETTINGS = {
    /** VADモード (0-3: 0=低感度, 3=高感度) */
    mode: 3,

    /** 最小音声継続時間 (ms) */
    minSpeechDuration: 100,

    /** 最小無音継続時間 (ms) */
    minSilenceDuration: 1000,

    /** 音声前後のパディング (ms) */
    speechPadding: 200,

    /** 環境に応じた自動調整 */
    autoAdjust: true
} as const;

/**
 * UI設定のデフォルト値
 */
export const DEFAULT_UI_SETTINGS = {
    /** プッシュ・トゥ・トーク機能の有効化 */
    pushToTalkEnabled: true,

    /** 音声レベルの可視化表示 */
    showVisualization: true,

    /** タイムスタンプのフォーマット */
    timestampFormat: 'YYYY-MM-DD-HH-mm-ss',

    /** 録音ボタンのサイズ */
    recordButtonSize: 'large' as 'small' | 'medium' | 'large'
} as const;

/**
 * 文字起こし設定のデフォルト値
 */
export const DEFAULT_TRANSCRIPTION_SETTINGS = {
    /** デフォルトの文字起こしモデル */
    model: 'gpt-4o-transcribe' as const,

    /** 言語設定 */
    language: 'auto',

    /** 文字起こし補正の有効化 */
    enableTranscriptionCorrection: true
} as const;

/**
 * 統合されたデフォルト設定
 */
export const DEFAULT_USER_SETTINGS = {
    /** 基本設定 */
    openaiApiKey: '',
    enableTranscriptionCorrection: DEFAULT_TRANSCRIPTION_SETTINGS.enableTranscriptionCorrection,

    /** 音声設定 */
    autoStopSilenceDuration: DEFAULT_AUDIO_SETTINGS.autoStopSilenceDuration,
    minSpeechDuration: DEFAULT_VAD_SETTINGS.minSpeechDuration,

    /** モデル設定 */
    transcriptionModel: DEFAULT_TRANSCRIPTION_SETTINGS.model,

    /** 詳細設定 (オプション) */
    advanced: {
        audio: DEFAULT_AUDIO_SETTINGS,
        vad: DEFAULT_VAD_SETTINGS,
        ui: DEFAULT_UI_SETTINGS
    }
} as const;

/** デフォルト設定の型 */
export type DefaultAudioSettings = typeof DEFAULT_AUDIO_SETTINGS;
export type DefaultVADSettings = typeof DEFAULT_VAD_SETTINGS;
export type DefaultUISettings = typeof DEFAULT_UI_SETTINGS;
export type DefaultTranscriptionSettings = typeof DEFAULT_TRANSCRIPTION_SETTINGS;
export type DefaultUserSettings = typeof DEFAULT_USER_SETTINGS;
