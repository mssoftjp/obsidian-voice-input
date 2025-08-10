/**
 * 文字起こし結果
 *
 * CLAUDE.mdの哲学に従った設計:
 * - 重要なメトリクスを必須化
 * - デバッグとトラッキングに必要な情報を保証
 */
export interface TranscriptionResult {
    /** 最終的な文字起こしテキスト */
    text: string;

    /** 使用されたモデル */
    model: string;

    /** 検出された言語 */
    language: string;

    /** 処理時間 (ms) */
    duration: number;

    /** オリジナルの文字起こしテキスト（修正前） */
    originalText?: string;

    /** 信頼度スコア (0-1) */
    confidence?: number;
}

export interface ITranscriptionProvider {
    transcribe(audio: Blob, language: string): Promise<TranscriptionResult>;
}

export interface ITextCorrector {
    correct(text: string): Promise<string>;
}

export interface CorrectionRule {
    pattern: RegExp;
    replacement: string;
    description?: string;
    caseSensitive?: boolean;
}

/**
 * 辞書修正オプション
 *
 * CLAUDE.mdの哲学に従った設計:
 * - シンプルな固定置換のみをサポート
 */
export interface DictionaryCorrectorOptions {
    enabled: boolean;
}

// Simple correction dictionary for speech recognition errors
export interface CorrectionEntry {
    from: string[];    // 誤認識パターン（複数対応）
    to: string;        // 正しい表記
}

// Legacy type for backward compatibility
export type CorrectionEntryLegacy = {
    from: string;
    to: string;
    category?: string;
}

export interface SimpleCorrectionDictionary {
    // 確実に修正すべきパターン
    definiteCorrections: CorrectionEntry[];
}
