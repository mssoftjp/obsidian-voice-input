/**
 * Universal prompt contamination cleaner
 * Removes instruction prompts, XML tags, and context patterns
 * Language-independent approach using structural patterns
 */

import { CleaningResult, TextCleaner, CleaningContext } from './interfaces';
import { CLEANING_CONFIG } from '../../../config/CleaningConfig';

// Simple logger interface for tests
interface SimpleLogger {
    debug: (message: string, metadata?: any) => void;
    warn: (message: string, metadata?: any) => void;
}

// Fallback logger for test environments
const createFallbackLogger = (): SimpleLogger => ({
    debug: () => {/* no-op */},
    warn: () => {/* no-op */}
});

export class PromptContaminationCleaner implements TextCleaner {
    readonly name = 'PromptContaminationCleaner';
    readonly enabled = true;
    private logger: SimpleLogger;
    
    constructor() {
        try {
            // Try to use the real logger
            const { createServiceLogger } = require('../../../services');
            this.logger = createServiceLogger('PromptContaminationCleaner');
        } catch {
            // Fall back to no-op logger for tests
            this.logger = createFallbackLogger();
        }
    }
    
    clean(text: string, language: string, context?: CleaningContext): CleaningResult {
        const original = text;
        const startTime = performance.now();
        let cleaned = text;
        const issues: string[] = [];
        let patternsMatched = 0;
        
        const { instructionPatterns, xmlPatternGroups, contextPatterns, promptSnippetLengths } = 
            CLEANING_CONFIG.contamination;
        
        // Step 1: Handle XML tags (highest priority)
        cleaned = this.removeXmlTags(cleaned, xmlPatternGroups);
        if (cleaned !== text) {
            patternsMatched++;
            this.logger.debug('XML tags removed');
        }
        
        // Step 2: Remove exact instruction matches at text beginning
        const beforeInstructions = cleaned;
        cleaned = this.removeInstructionPatterns(cleaned, instructionPatterns);
        if (cleaned !== beforeInstructions) {
            patternsMatched++;
            this.logger.debug('Instruction patterns removed');
        }
        
        // Step 3: Remove snippet matches (conservative)
        const beforeSnippets = cleaned;
        cleaned = this.removeSnippetPatterns(cleaned, instructionPatterns, promptSnippetLengths);
        if (cleaned !== beforeSnippets) {
            patternsMatched++;
            this.logger.debug('Snippet patterns removed');
        }
        
        // Step 4: Apply context patterns
        const beforeContext = cleaned;
        cleaned = this.removeContextPatterns(cleaned, contextPatterns);
        if (cleaned !== beforeContext) {
            patternsMatched++;
            this.logger.debug('Context patterns removed');
        }
        
        // Step 5: Clean up excessive whitespace
        cleaned = this.normalizeWhitespace(cleaned);
        
        const processingTime = performance.now() - startTime;
        const reductionRatio = original.length > 0 ? (original.length - cleaned.length) / original.length : 0;
        
        // Add warnings for significant changes
        if (reductionRatio > CLEANING_CONFIG.safety.warningThreshold) {
            issues.push(`High reduction ratio: ${Math.round(reductionRatio * 100)}%`);
        }
        
        if (context?.enableDetailedLogging) {
            this.logger.debug('Prompt contamination cleaning completed', {
                originalLength: original.length,
                cleanedLength: cleaned.length,
                reductionRatio: reductionRatio.toFixed(3),
                patternsMatched,
                processingTime: `${processingTime.toFixed(2)}ms`
            });
        }
        
        return {
            cleanedText: cleaned,
            issues,
            hasSignificantChanges: reductionRatio > 0.05,
            metadata: {
                reductionRatio,
                patternsMatched,
                processingTime
            }
        };
    }
    
    /**
     * Remove XML tags in priority order
     */
    private removeXmlTags(text: string, xmlPatternGroups: typeof CLEANING_CONFIG.contamination.xmlPatternGroups): string {
        let cleaned = text;
        
        // First: Extract content from complete TRANSCRIPT tags (highest priority)
        const completeTagMatch = cleaned.match(/<TRANSCRIPT[^>]*>\s*([\s\S]*?)\s*<\/TRANSCRIPT>/);
        if (completeTagMatch) {
            cleaned = completeTagMatch[1].trim();
        } else {
            // Second: Handle incomplete TRANSCRIPT tags (missing closing tag)
            const openingMatch = cleaned.match(/<TRANSCRIPT[^>]*>\s*([\s\S]*)/);
            if (openingMatch) {
                cleaned = openingMatch[1].trim();
            }
        }
        
        // Third: Remove any remaining XML-like tags
        cleaned = cleaned.replace(/<\/?TRANSCRIPT[^>]*>/g, '');
        cleaned = cleaned.replace(/<\/?transcript[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/?TRANSCRIPTION[^>]*>/gi, '');
        
        // Remove standalone tags and empty XML tags
        cleaned = cleaned.replace(/<[^>]*\/>/g, '');
        cleaned = cleaned.replace(/<\w+[^>]*>\s*<\/\w+>/g, '');
        
        return cleaned;
    }
    
    /**
     * Remove instruction patterns from the beginning of text
     */
    private removeInstructionPatterns(text: string, instructionPatterns: string[]): string {
        let cleaned = text;
        
        for (const pattern of instructionPatterns) {
            // Check if text starts with this pattern
            if (cleaned.trimStart().startsWith(pattern)) {
                const index = cleaned.indexOf(pattern);
                if (index >= 0) {
                    cleaned = cleaned.slice(index + pattern.length).trim();
                }
            }
        }
        
        return cleaned;
    }
    
    /**
     * Remove snippet patterns (partial matches with context)
     */
    private removeSnippetPatterns(text: string, instructionPatterns: string[], snippetLengths: number[]): string {
        let cleaned = text;
        
        for (const pattern of instructionPatterns) {
            for (const length of snippetLengths) {
                if (pattern.length < length) continue;
                
                const snippet = pattern.slice(0, length);
                // Escape special regex characters
                const escapedSnippet = snippet.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                
                // Create contextual regex for snippet matching
                // Look for snippet followed by instruction-like endings
                const contextRegex = new RegExp(
                    `${escapedSnippet}[^。.!?！？\\n]{0,50}(?:ください|してください|です|ます|please|only|content)\\b`,
                    'gi'
                );
                
                cleaned = cleaned.replace(contextRegex, '');
            }
        }
        
        return cleaned;
    }
    
    /**
     * Apply context patterns for general cleanup
     */
    private removeContextPatterns(text: string, contextPatterns: string[]): string {
        let cleaned = text;
        
        // Direct pattern matching for speaker-only phrases
        const speakerPatterns = [
            /\(Speaker content only\)/gi,
            /\(SPEAKER CONTENT ONLY\)/gi,
            /（話者の発言のみ）/g,
            /（仅说话者内容）/g,
            /（화자 발언만）/g
        ];
        
        for (const pattern of speakerPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }
        
        // Remove format-only lines
        const formatPatterns = [
            /^Output format:\s*$/gm,
            /^Format:\s*$/gm,
            /^出力形式:\s*$/gm,
            /^输出格式:\s*$/gm,
            /^출력 형식:\s*$/gm
        ];
        
        for (const pattern of formatPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }
        
        return cleaned;
    }
    
    /**
     * Normalize whitespace while preserving structure
     */
    private normalizeWhitespace(text: string): string {
        return text
            .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
            .replace(/^\s*\n/gm, '')     // Remove lines with only whitespace
            .trim();
    }
}