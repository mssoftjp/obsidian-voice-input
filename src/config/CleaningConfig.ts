/**
 * Configuration for the text cleaning pipeline
 * Centralized management of thresholds, patterns, and safety limits
 * Language-independent approach with universal patterns
 */

export interface SafetyThresholds {
    /** Maximum reduction allowed by a single cleaner (0.0-1.0) */
    singleCleanerMaxReduction: number;
    /** Maximum reduction allowed for a single pattern match (0.0-1.0) */
    singlePatternMaxReduction: number;
    /** Maximum reduction allowed for repetition patterns (0.0-1.0) */
    repetitionPatternMaxReduction: number;
    /** Maximum reduction allowed per iteration (0.0-1.0) */
    iterationReductionLimit: number;
    /** Emergency fallback threshold - rollback if exceeded (0.0-1.0) */
    emergencyFallbackThreshold: number;
    /** Warning threshold for logging (0.0-1.0) */
    warningThreshold: number;
}

export interface RepetitionThresholds {
    /** Base threshold for repetition detection */
    baseThreshold: number;
    /** Length factor for dynamic threshold calculation */
    lengthFactor: number;
    /** Divisor for dynamic threshold based on text length */
    dynamicThresholdDivisor: number;
    /** Ratio of repeated items to keep (0.0-1.0) */
    shortCharKeepRatio: number;
    /** Threshold for sentence repetition detection */
    sentenceRepetition: number;
    /** Similarity threshold for sentence comparison (0.0-1.0) */
    similarityThreshold: number;
    /** Minimum sentence length for similarity comparison */
    minimumSentenceLengthForSimilarity: number;
    /** Maximum consecutive newlines to allow */
    consecutiveNewlineLimit: number;
    /** N-gram configuration for phrase repetition detection */
    ngram: {
        min: number;
        max: number;
        thresholds: Array<{ n: number; repeat: number }>;
    };
    /** Enumeration detection configuration */
    enumerationDetection: {
        enabled: boolean;
        minRepeatCount: number;
    };
    /** Paragraph repetition detection configuration */
    paragraphRepeat: {
        enabled: boolean;
        headChars: number;
    };
}

export interface ContaminationPatterns {
    /** Instruction patterns to remove from text beginning */
    instructionPatterns: string[];
    /** XML pattern groups for different contexts */
    xmlPatternGroups: {
        completeXmlTags: string[];
        sentenceBoundedTags: string[];
        lineBoundedTags: string[];
        standaloneTags: string[];
    };
    /** Context patterns for general cleanup */
    contextPatterns: string[];
    /** Prompt snippet lengths for partial matching */
    promptSnippetLengths: number[];
}

export interface CleaningConfig {
    safety: SafetyThresholds;
    repetition: RepetitionThresholds;
    contamination: ContaminationPatterns;
}

/**
 * Default cleaning configuration with conservative settings
 * Optimized for safety and minimal false positives
 */
export const CLEANING_CONFIG: CleaningConfig = {
    safety: {
        singleCleanerMaxReduction: 0.3,
        singlePatternMaxReduction: 0.15,
        repetitionPatternMaxReduction: 0.25,
        iterationReductionLimit: 0.2,
        emergencyFallbackThreshold: 0.5,
        warningThreshold: 0.15
    },

    repetition: {
        baseThreshold: 3,
        lengthFactor: 2,
        dynamicThresholdDivisor: 100,
        shortCharKeepRatio: 0.3,
        sentenceRepetition: 3,
        similarityThreshold: 0.85,
        minimumSentenceLengthForSimilarity: 10,
        consecutiveNewlineLimit: 3,
        ngram: {
            min: 3,
            max: 10,
            thresholds: [
                { n: 3, repeat: 4 },
                { n: 4, repeat: 3 },
                { n: 5, repeat: 3 },
                { n: 6, repeat: 2 },
                { n: 7, repeat: 2 },
                { n: 8, repeat: 2 },
                { n: 9, repeat: 2 },
                { n: 10, repeat: 2 }
            ]
        },
        enumerationDetection: {
            enabled: true,
            minRepeatCount: 3
        },
        paragraphRepeat: {
            enabled: true,
            headChars: 50
        }
    },

    contamination: {
        instructionPatterns: [
            // Universal instruction patterns (language-independent structure)
            'Please transcribe only the following audio content',
            'Do not include this instruction in your output',
            'Record only the speaker\'s statements accurately',
            'PLEASE TRANSCRIBE ONLY THE FOLLOWING AUDIO CONTENT',
            'RECORD ONLY THE SPEAKER\'S STATEMENTS ACCURATELY',
            '以下の音声内容のみを文字に起こしてください',
            'この指示文は出力に含めないでください',
            '話者の発言内容だけを正確に記録してください',
            '请仅转录以下音频内容',
            '不要包含此指令在输出中',
            '请准确记录说话者的发言内容',
            '다음 음성 내용만 전사해주세요',
            '이 지시사항을 출력에 포함하지 마세요',
            '화자의 발언 내용만 정확히 기록해주세요'
        ],

        xmlPatternGroups: {
            completeXmlTags: [
                '/<TRANSCRIPT[^>]*>([\\s\\S]*?)<\\/TRANSCRIPT>/g',
                '/<transcript[^>]*>([\\s\\S]*?)<\\/transcript>/g',
                '/<TRANSCRIPTION[^>]*>([\\s\\S]*?)<\\/TRANSCRIPTION>/g'
            ],
            sentenceBoundedTags: [
                '/<\\/?TRANSCRIPT[^>]*>/g',
                '/<\\/?transcript[^>]*>/g',
                '/<\\/?TRANSCRIPTION[^>]*>/g'
            ],
            lineBoundedTags: [
                '/^\\s*<[^>]*>\\s*$/gm',
                '/^\\s*<\\/[^>]*>\\s*$/gm'
            ],
            standaloneTags: [
                '/<[^>]*\\/>/g',
                '/<\\w+[^>]*>\\s*<\\/\\w+>/g'
            ]
        },

        contextPatterns: [
            // Universal context patterns (structural)
            '/^\\s*\\([^)]*Speaker[^)]*only[^)]*\\)\\s*$/gmi',
            '/^\\s*（[^）]*話者[^）]*のみ[^）]*）\\s*$/gm',
            '/^\\s*（[^）]*说话者[^）]*内容[^）]*）\\s*$/gm',
            '/^\\s*（[^）]*화자[^）]*발언만[^）]*）\\s*$/gm',
            '/\\b(output|format|instruction)\\s*:?\\s*$/gmi',
            '/^\\s*(transcribe|record|speak)\\s+only\\b.*$/gmi'
        ],

        promptSnippetLengths: [20, 30, 40, 50]
    }
};
