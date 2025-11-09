/**
 * Core interfaces for the text cleaning pipeline
 * Provides contracts for cleaners, results, and pipeline execution
 */

/**
 * Result of a text cleaning operation
 */
export interface CleaningResult {
    /** The cleaned text */
    cleanedText: string;
    /** List of issues or warnings encountered during cleaning */
    issues: string[];
    /** Whether significant changes were made */
    hasSignificantChanges: boolean;
    /** Additional metadata about the cleaning operation */
    metadata?: Record<string, unknown>;
}

/**
 * Context information for cleaning operations
 */
export interface CleaningContext {
    /** Language code ('auto' for auto-detection) */
    language: string;
    /** Original text length before any cleaning */
    originalLength: number;
    /** Enable detailed logging for debugging */
    enableDetailedLogging?: boolean;
    /** Original prompt used for transcription (if any) */
    originalPrompt?: string;
    /** Processing start time for performance tracking */
    startTime?: number;
}

/**
 * Interface for text cleaning implementations
 */
export interface TextCleaner {
    /** Unique name for this cleaner */
    readonly name: string;
    /** Whether this cleaner is enabled */
    readonly enabled: boolean;

    /**
     * Clean the given text
     * @param text Text to clean
     * @param language Language code
     * @param context Additional context for cleaning
     * @returns Cleaning result (can be async)
     */
    clean(text: string, language: string, context?: CleaningContext): Promise<CleaningResult> | CleaningResult;
}

/**
 * Interface for cleaning pipeline implementations
 */
export interface CleaningPipeline {
    /** Unique name for this pipeline */
    readonly name: string;

    /**
     * Execute the complete cleaning pipeline
     * @param text Text to clean
     * @param language Language code
     * @param context Additional context for cleaning
     * @returns Final cleaned text with metadata
     */
    execute(text: string, language: string, context?: CleaningContext): Promise<{
        finalText: string;
        metadata: {
            totalOriginalLength: number;
            totalFinalLength: number;
            totalReductionRatio: number;
            cleanerResults?: Array<{
                cleanerName: string;
                reductionRatio: number;
                processingTime: number;
                issues: string[];
            }>;
        };
    }>;
}

/**
 * Safety check result for cleaning operations
 */
export interface SafetyCheckResult {
    /** Whether the operation is safe to proceed */
    isSafe: boolean;
    /** Reason for safety failure (if any) */
    reason?: string;
    /** Suggested action */
    action: 'proceed' | 'skip' | 'rollback';
    /** Calculated reduction ratio */
    reductionRatio: number;
}

/**
 * Performance metrics for cleaning operations
 */
export interface CleaningMetrics {
    /** Cleaner name */
    cleanerName: string;
    /** Processing time in milliseconds */
    processingTime: number;
    /** Original text length */
    originalLength: number;
    /** Final text length */
    finalLength: number;
    /** Reduction ratio (0.0-1.0) */
    reductionRatio: number;
    /** Number of patterns matched */
    patternsMatched: number;
    /** Issues encountered */
    issues: string[];
}
