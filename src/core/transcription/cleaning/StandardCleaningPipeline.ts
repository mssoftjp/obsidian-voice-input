/**
 * Standard implementation of the cleaning pipeline
 * Orchestrates multiple cleaners with safety monitoring and metrics collection
 */

import { CleaningPipeline, CleaningContext, TextCleaner, SafetyCheckResult } from './interfaces';
import { CLEANING_CONFIG } from '../../../config/CleaningConfig';

// Simple logger interface for tests
interface SimpleLogger {
    info: (message: string, metadata?: any) => void;
    debug: (message: string, metadata?: any) => void;
    warn: (message: string, metadata?: any) => void;
    error: (message: string, error?: any) => void;
}

// Fallback logger for test environments
const createFallbackLogger = (): SimpleLogger => ({
    info: () => {/* no-op */},
    debug: () => {/* no-op */},
    warn: () => {/* no-op */},
    error: () => {/* no-op */}
});

export class StandardCleaningPipeline implements CleaningPipeline {
    readonly name = 'StandardCleaningPipeline';
    private logger: SimpleLogger;
    
    constructor(private cleaners: TextCleaner[] = []) {
        try {
            // Try to use the real logger
            const { createServiceLogger } = require('../../../services');
            this.logger = createServiceLogger('StandardCleaningPipeline');
        } catch {
            // Fall back to no-op logger for tests
            this.logger = createFallbackLogger();
        }
    }
    
    async execute(text: string, language: string, context?: CleaningContext) {
        const startTime = performance.now();
        const originalLength = text.length;
        
        const fullContext: CleaningContext = {
            language,
            originalLength,
            startTime,
            ...context
        };
        
        this.logger.info('Starting cleaning pipeline', {
            originalLength,
            language,
            cleanerCount: this.cleaners.length,
            enabledCleaners: this.cleaners.filter(c => c.enabled).length
        });
        
        let currentText = text;
        const cleanerResults: Array<{
            cleanerName: string;
            reductionRatio: number;
            processingTime: number;
            issues: string[];
        }> = [];
        
        // Execute each cleaner in sequence
        for (const cleaner of this.cleaners) {
            if (!cleaner.enabled) {
                this.logger.debug(`Skipping disabled cleaner: ${cleaner.name}`);
                continue;
            }
            
            const cleanerStartTime = performance.now();
            const textBeforeCleaner = currentText;
            
            try {
                this.logger.debug(`Executing cleaner: ${cleaner.name}`, {
                    inputLength: textBeforeCleaner.length
                });
                
                const result = await Promise.resolve(
                    cleaner.clean(textBeforeCleaner, language, fullContext)
                );
                
                // Safety check
                const safetyCheck = this.performSafetyCheck(
                    textBeforeCleaner,
                    result.cleanedText,
                    cleaner.name
                );
                
                if (safetyCheck.action === 'rollback') {
                    this.logger.warn(`Rolling back cleaner ${cleaner.name}`, {
                        reason: safetyCheck.reason,
                        reductionRatio: safetyCheck.reductionRatio
                    });
                    // Keep original text, don't apply this cleaner
                } else if (safetyCheck.action === 'skip') {
                    this.logger.warn(`Skipping cleaner ${cleaner.name}`, {
                        reason: safetyCheck.reason
                    });
                    // Keep original text, don't apply this cleaner
                } else {
                    // Apply the cleaned text
                    currentText = result.cleanedText;
                }
                
                const processingTime = performance.now() - cleanerStartTime;
                const reductionRatio = textBeforeCleaner.length > 0 
                    ? (textBeforeCleaner.length - currentText.length) / textBeforeCleaner.length 
                    : 0;
                
                cleanerResults.push({
                    cleanerName: cleaner.name,
                    reductionRatio,
                    processingTime,
                    issues: result.issues
                });
                
                this.logger.debug(`Completed cleaner: ${cleaner.name}`, {
                    outputLength: currentText.length,
                    reductionRatio: reductionRatio.toFixed(3),
                    processingTime: `${processingTime.toFixed(2)}ms`,
                    issueCount: result.issues.length
                });
                
                // Log warnings for significant changes
                if (reductionRatio > CLEANING_CONFIG.safety.warningThreshold) {
                    this.logger.warn(`High reduction ratio in ${cleaner.name}`, {
                        reductionRatio: reductionRatio.toFixed(3),
                        threshold: CLEANING_CONFIG.safety.warningThreshold
                    });
                }
                
            } catch (error) {
                this.logger.error(`Error in cleaner ${cleaner.name}`, error);
                cleanerResults.push({
                    cleanerName: cleaner.name,
                    reductionRatio: 0,
                    processingTime: performance.now() - cleanerStartTime,
                    issues: [`Error: ${error instanceof Error ? error.message : String(error)}`]
                });
                // Continue with the original text if a cleaner fails
            }
        }
        
        const totalProcessingTime = performance.now() - startTime;
        const totalReductionRatio = originalLength > 0 
            ? (originalLength - currentText.length) / originalLength 
            : 0;
        
        // Final safety check for the entire pipeline
        const finalSafetyCheck = this.performSafetyCheck(text, currentText, 'Pipeline');
        if (finalSafetyCheck.action === 'rollback') {
            this.logger.error('Pipeline safety failure - reverting to original text', {
                reason: finalSafetyCheck.reason,
                totalReductionRatio: finalSafetyCheck.reductionRatio
            });
            currentText = text;
        }
        
        this.logger.info('Cleaning pipeline completed', {
            originalLength,
            finalLength: currentText.length,
            totalReductionRatio: totalReductionRatio.toFixed(3),
            totalProcessingTime: `${totalProcessingTime.toFixed(2)}ms`,
            cleanersExecuted: cleanerResults.length
        });
        
        return {
            finalText: currentText,
            metadata: {
                totalOriginalLength: originalLength,
                totalFinalLength: currentText.length,
                totalReductionRatio,
                cleanerResults
            }
        };
    }
    
    /**
     * Perform safety checks on cleaning results
     */
    private performSafetyCheck(
        originalText: string,
        cleanedText: string,
        cleanerName: string
    ): SafetyCheckResult {
        const originalLength = originalText.length;
        const cleanedLength = cleanedText.length;
        
        if (originalLength === 0) {
            return { isSafe: true, action: 'proceed', reductionRatio: 0 };
        }
        
        const reductionRatio = (originalLength - cleanedLength) / originalLength;

        // Relax safety thresholds for structural cleaners that may legitimately
        // remove large wrappers (e.g., TRANSCRIPT tags or full prompt lines).
        // This prevents false rollbacks like when input is mostly XML wrappers.
        const isStructuralCleaner = cleanerName === 'PromptContaminationCleaner';
        const emergencyThreshold = isStructuralCleaner
            ? Math.max(0.95, CLEANING_CONFIG.safety.emergencyFallbackThreshold)
            : CLEANING_CONFIG.safety.emergencyFallbackThreshold;
        const singleCleanerThreshold = isStructuralCleaner
            ? Math.max(0.9, CLEANING_CONFIG.safety.singleCleanerMaxReduction)
            : CLEANING_CONFIG.safety.singleCleanerMaxReduction;
        
        // Check against emergency fallback threshold
        if (reductionRatio > emergencyThreshold) {
            return {
                isSafe: false,
                reason: `Reduction ratio ${reductionRatio.toFixed(3)} exceeds emergency threshold ${emergencyThreshold}`,
                action: 'rollback',
                reductionRatio
            };
        }
        
        // Check against single cleaner threshold
        if (reductionRatio > singleCleanerThreshold) {
            return {
                isSafe: false,
                reason: `Reduction ratio ${reductionRatio.toFixed(3)} exceeds single cleaner threshold ${singleCleanerThreshold}`,
                action: 'skip',
                reductionRatio
            };
        }
        
        return { isSafe: true, action: 'proceed', reductionRatio };
    }
    
    /**
     * Add a cleaner to the pipeline
     */
    addCleaner(cleaner: TextCleaner): void {
        this.cleaners.push(cleaner);
    }
    
    /**
     * Remove a cleaner from the pipeline
     */
    removeCleaner(cleanerName: string): boolean {
        const index = this.cleaners.findIndex(c => c.name === cleanerName);
        if (index >= 0) {
            this.cleaners.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * Get all cleaners in the pipeline
     */
    getCleaners(): readonly TextCleaner[] {
        return Object.freeze([...this.cleaners]);
    }
}
