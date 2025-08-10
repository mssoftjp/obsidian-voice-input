/**
 * APIモデルのコスト情報
 * 価格は1分あたりのUSDで表記
 * 最新の価格はOpenAIの公式サイトで確認してください。
 */

/**
 * 音声文字起こしモデルのコスト ($/分)
 */
export const TRANSCRIPTION_MODEL_COSTS = {
    /** GPT-4o Transcribe - 高精度版 */
    'gpt-4o-transcribe': 0.06,

    /** GPT-4o Mini Transcribe - コスト効率版 */
    'gpt-4o-mini-transcribe': 0.03,

    /** Whisper Large (参考) */
    'whisper-1': 0.006
} as const;

/**
 * コスト計算のヘルパー関数
 */
export const CostCalculator = {
    /**
   * 音声文字起こしのコストを計算
   * @param durationSeconds 音声の長さ（秒）
   * @param model 使用するモデル
   * @returns コスト（USD）
   */
    calculateTranscriptionCost(
        durationSeconds: number,
        model: keyof typeof TRANSCRIPTION_MODEL_COSTS
    ): number {
        const durationMinutes = durationSeconds / 60;
        const costPerMinute = TRANSCRIPTION_MODEL_COSTS[model];
        return durationMinutes * costPerMinute;
    },

    /**
   * テキストからトークン数を概算
   * 日本語の場合: 1文字 ≈ 0.5トークン
   * 英語の場合: 1単語 ≈ 1.3トークン
   * @param text テキスト
   * @param language 言語
   * @returns 概算トークン数
   */
    estimateTokens(text: string, language = 'ja'): number {
        if (language === 'ja') {
            // 日本語: 文字数の約半分
            return Math.ceil(text.length * 0.5);
        } else {
            // 英語: 単語数の約1.3倍
            const words = text.split(/\s+/).length;
            return Math.ceil(words * 1.3);
        }
    },

    /**
   * 月間コストを予測（文字起こしのみ）
   * @param dailyMinutes 1日あたりの使用分数
   * @param transcriptionModel 文字起こしモデル
   * @returns 月間予測コスト（USD）
   */
    estimateMonthlyCost(
        dailyMinutes: number,
        transcriptionModel: keyof typeof TRANSCRIPTION_MODEL_COSTS
    ): number {
    // 文字起こしコスト（30日分）
        return dailyMinutes * 30 * TRANSCRIPTION_MODEL_COSTS[transcriptionModel];
    }
} as const;

/**
 * コスト情報の表示用フォーマット
 */
export const COST_DISPLAY = {
    /**
   * 金額をフォーマット
   * @param amount 金額（USD）
   * @param decimals 小数点以下の桁数
   * @returns フォーマットされた文字列
   */
    formatCost(amount: number, decimals = 2): string {
        return `$${amount.toFixed(decimals)}`;
    },

    /**
   * コストの比較を表示
   * @param costA コストA
   * @param costB コストB
   * @returns 比較結果の文字列
   */
    compareCost(costA: number, costB: number): string {
        const ratio = costA / costB;
        if (ratio > 1) {
            return `${ratio.toFixed(1)}倍高い`;
        } else {
            return `${(1 / ratio).toFixed(1)}倍安い`;
        }
    }
} as const;

/** コスト関連の型定義 */
export type TranscriptionModelCosts = typeof TRANSCRIPTION_MODEL_COSTS;
export type CostCalculatorType = typeof CostCalculator;
export type CostDisplayType = typeof COST_DISPLAY;
