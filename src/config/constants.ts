/**
 * 技術的な定数の定義
 * これらの値は内部的に使用され、通常ユーザーが変更する必要はありません
 */

/**
 * オーディオ関連の定数
 */
export const AUDIO_CONSTANTS = {
    /** WebRTC VADが要求するサンプルレート (Hz) */
    SAMPLE_RATE: 16000,

    /** オーディオ処理のバッファサイズ */
    BUFFER_SIZE: 4096,

    /** 最大録音時間 (秒) */
    MAX_RECORDING_SECONDS: 300,

    /** デフォルトのリングバッファ最大時間 (秒) */
    DEFAULT_RING_BUFFER_SECONDS: 300,

    /** オーディオコンテキストのレイテンシーヒント */
    LATENCY_HINT: 'interactive' as const,

    /** デフォルトのゲイン値 */
    DEFAULT_GAIN: 1.0,

    /** オーディオフィルター設定 */
    FILTERS: {
    /** ハイパスフィルターの周波数 (Hz) - 低周波ノイズ除去 */
        HIGH_PASS_FREQ: 80,
        /** ローパスフィルターの周波数 (Hz) - 高周波ノイズ除去 */
        LOW_PASS_FREQ: 7600
    },

    /** マイク入力検出の閾値 */
    MIC_DETECTION_THRESHOLD: 0.0001,

    /** 録音フォーマット */
    WEBM_CODEC: 'audio/webm;codecs=opus',

    /** MediaRecorderのデータ収集間隔 (ms) */
    RECORDER_TIMESLICE: 100,

    /** バッファ使用率の警告閾値 (%) */
    BUFFER_WARNING_THRESHOLD: 80,

    /** バッファ統計ログの出力確率 */
    BUFFER_STATS_LOG_PROBABILITY: 0.01
} as const;

/**
 * VAD (Voice Activity Detection) 関連の定数
 */
export const VAD_CONSTANTS = {
    /** VADフレームサイズ (16kHzで30ms) */
    FRAME_SIZE: 480,

    /** VADが要求するサンプルレート (Hz) */
    SAMPLE_RATE: 16000,

    /** 入力オーディオのサンプルレート (Hz) */
    INPUT_SAMPLE_RATE: 48000,

    /** ノイズレベルの閾値 */
    NOISE_THRESHOLDS: {
    /** 騒音環境の閾値 */
        NOISY: 0.1,
        /** 通常環境の閾値 */
        NORMAL: 0.05
    },

    /** VADモード自動調整の間隔 (フレーム数) */
    ADJUSTMENT_INTERVAL: 100,

    /** ノイズレベルの指数移動平均係数 */
    NOISE_LEVEL_EMA: {
    /** 前の値の重み */
        PREVIOUS: 0.95,
        /** 現在の値の重み */
        CURRENT: 0.05
    },

    /** VAD結果の蓄積閾値 (フレーム数) */
    VAD_ACCUMULATION_THRESHOLD: 10
} as const;

/**
 * 可視化関連の定数
 */
export const VISUALIZATION_CONSTANTS = {
    /** キャンバスのサイズ */
    CANVAS: {
        WIDTH: 200,
        HEIGHT: 60
    },

    /** 波形履歴の最大長 */
    MAX_HISTORY_LENGTH: 300,

    /** FFTサイズ (詳細表示用) */
    FFT_SIZE: 2048,

    /** FFTサイズ (シンプル表示用) */
    SIMPLE_FFT_SIZE: 256,

    /** 関連する周波数ビンの数 */
    RELEVANT_BINS: 50,

    /** オーディオレベルのスケーリング係数 */
    LEVEL_SCALING: 128,

    /** VAD閾値のデフォルト値 */
    DEFAULT_VAD_THRESHOLD: 0.02
} as const;

/**
 * API関連の定数
 */
export const API_CONSTANTS = {
    /** APIエンドポイント */
    ENDPOINTS: {
    /** 音声文字起こしAPI */
        TRANSCRIPTION: 'https://api.openai.com/v1/audio/transcriptions'
    },

    /** APIパラメータ */
    PARAMETERS: {
    /** 文字起こしの温度パラメータ (決定論的) */
        TRANSCRIPTION_TEMPERATURE: 0.0,
        /** 最大トークン数 */
        MAX_TOKENS: 2000
    }
} as const;

/**
 * ファイルシステム関連の定数
 */
export const FILE_CONSTANTS = {
    /** プラグインID */
    PLUGIN_ID: 'voice-input',

    /** WASMファイルのパス */
    WASM_PATHS: {
        JS: 'src/lib/fvad-wasm/fvad.js',
        WASM: 'src/lib/fvad-wasm/fvad.wasm'
    }
} as const;

/**
 * 辞書関連の定数
 */
export const DICTIONARY_CONSTANTS = {
    /** 固定補正の最大個数 */
    MAX_DEFINITE_CORRECTIONS: 200,

    /** 文脈補正の最大個数 */
    MAX_CONTEXTUAL_CORRECTIONS: 150,

    /** 補正カテゴリ（IMEの品詞分類を参考） */
    CATEGORIES: [
        'noun',         // 名詞
        'person',       // 人名
        'place',        // 地名
        'org',          // 組織名
        'proper',       // その他固有名詞
        'technical',    // 専門用語
        'spoken',       // 話し言葉
        'symbol'        // 記号・単位
    ] as const,

    /** デフォルトカテゴリ */
    DEFAULT_CATEGORY: 'noun'
} as const;

/**
 * UI関連の定数
 */
export const UI_CONSTANTS = {
    /** プッシュ・トゥ・トークの閾値 (ms) */
    PUSH_TO_TALK_THRESHOLD: 300,

    /** プッシュトゥトークのフラグリセット遅延 (ms) */
    PUSH_TO_TALK_RESET_DELAY: 100,

    /** フィードバック表示の遅延時間 (ms) */
    FEEDBACK_DELAY: 3000,

    /** レコードボタンのスタイル */
    RECORD_BUTTON: {
        PADDING: '32px 20px',
        FONT_SIZE: '20px',
        MIN_HEIGHT: '80px'
    },

    /** テキストエリアの最小高さ */
    TEXTAREA_MIN_HEIGHT: '200px',

    /** アニメーション */
    ANIMATION: {
    /** パルスアニメーションの周期 */
        PULSE_DURATION: '1.5s'
    }
} as const;

/** すべての定数の型 */
export type AudioConstants = typeof AUDIO_CONSTANTS;
export type VADConstants = typeof VAD_CONSTANTS;
export type VisualizationConstants = typeof VISUALIZATION_CONSTANTS;
export type APIConstants = typeof API_CONSTANTS;
export type FileConstants = typeof FILE_CONSTANTS;
export type UIConstants = typeof UI_CONSTANTS;
