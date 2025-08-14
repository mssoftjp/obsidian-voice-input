/**
 * Universal repetition cleaner - language-independent approach
 * Handles character/token/phrase/sentence/paragraph/enumeration/tail repetitions
 * Uses structural patterns rather than language-specific rules
 */

import { CleaningResult, TextCleaner, CleaningContext } from './interfaces';
import { CLEANING_CONFIG } from '../../../config/CleaningConfig';

// Simple logger interface for tests
interface SimpleLogger {
    debug: (message: string, metadata?: any) => void;
}

// Fallback logger for test environments
const createFallbackLogger = (): SimpleLogger => ({
    debug: () => {/* no-op */}
});

export class UniversalRepetitionCleaner implements TextCleaner {
    readonly name = 'UniversalRepetitionCleaner';
    readonly enabled = true;
    private logger: SimpleLogger;
    
    constructor() {
        try {
            // Try to use the real logger
            const { createServiceLogger } = require('../../../services');
            this.logger = createServiceLogger('UniversalRepetitionCleaner');
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
        let totalReductionSteps = 0;
        
        // Safety check: don't process very short texts
        if (text.length < 10) {
            return {
                cleanedText: text,
                issues: [],
                hasSignificantChanges: false,
                metadata: { processingTime: performance.now() - startTime }
            };
        }
        
        // Step 1: Character and symbol repetition suppression
        const step1Result = this.suppressCharacterRepetitions(cleaned);
        cleaned = step1Result.text;
        totalReductionSteps += step1Result.changes;
        
        // Step 2: Token repetition suppression  
        const step2Result = this.suppressTokenRepetitions(cleaned, original.length);
        cleaned = step2Result.text;
        totalReductionSteps += step2Result.changes;
        
        // Step 3: Sentence repetition suppression
        const step3Result = this.suppressSentenceRepetitions(cleaned);
        cleaned = step3Result.text;
        totalReductionSteps += step3Result.changes;
        
        // Step 4: Enumeration compression
        if (CLEANING_CONFIG.repetition.enumerationDetection.enabled) {
            const step4Result = this.compressEnumerations(cleaned);
            cleaned = step4Result.text;
            totalReductionSteps += step4Result.changes;
        }
        
        // Step 5: Paragraph repetition suppression
        if (CLEANING_CONFIG.repetition.paragraphRepeat.enabled) {
            const step5Result = this.suppressParagraphRepetitions(cleaned);
            cleaned = step5Result.text;
            totalReductionSteps += step5Result.changes;
        }
        
        // Step 6: Tail repetition suppression
        const step6Result = this.suppressTailRepetitions(cleaned);
        cleaned = step6Result.text;
        totalReductionSteps += step6Result.changes;
        
        // Step 7: Final cleanup
        cleaned = this.finalCleanup(cleaned);
        
        const processingTime = performance.now() - startTime;
        const reductionRatio = original.length > 0 ? (original.length - cleaned.length) / original.length : 0;
        
        // Safety check: if reduction is too high, fall back to original
        if (reductionRatio > CLEANING_CONFIG.safety.emergencyFallbackThreshold) {
            issues.push(`Emergency fallback: excessive reduction (${Math.round(reductionRatio * 100)}%)`);
            cleaned = original;
        }
        
        if (context?.enableDetailedLogging) {
            this.logger.debug('Universal repetition cleaning completed', {
                originalLength: original.length,
                cleanedLength: cleaned.length,
                reductionRatio: reductionRatio.toFixed(3),
                totalReductionSteps,
                processingTime: `${processingTime.toFixed(2)}ms`
            });
        }
        
        return {
            cleanedText: cleaned,
            issues,
            hasSignificantChanges: reductionRatio > 0.05,
            metadata: {
                reductionRatio,
                totalReductionSteps,
                processingTime
            }
        };
    }
    
    /**
     * Suppress character and symbol repetitions (language-independent)
     */
    private suppressCharacterRepetitions(text: string): { text: string; changes: number } {
        let result = text;
        let changes = 0;
        
        // Define repetition patterns with their limits
        const patterns = [
            { pattern: /([.!?])\1{5,}/g, replacement: '$1$1$1', description: 'punctuation' },
            { pattern: /[…]{3,}/g, replacement: '…', description: 'ellipsis' },
            { pattern: /[-—–]{6,}/g, replacement: '—', description: 'dashes' },
            { pattern: /[•·・]{6,}/g, replacement: '・', description: 'bullets' },
            { pattern: /[,，]{4,}/g, replacement: ',,', description: 'commas' },
            { pattern: /[\s]{4,}/g, replacement: '   ', description: 'spaces' }
        ];
        
        for (const { pattern, replacement } of patterns) {
            const before = result;
            result = result.replace(pattern, replacement);
            if (result !== before) changes++;
        }
        
        return { text: result, changes };
    }
    
    /**
     * Suppress token repetitions using language-independent tokenization
     */
    private suppressTokenRepetitions(text: string, originalLength: number): { text: string; changes: number } {
        const config = CLEANING_CONFIG.repetition;
        let changes = 0;
        
        // Language-independent tokenization
        const tokens = this.tokenizeText(text);
        const tokenCounts = new Map<string, number>();
        
        // Count normalized tokens (case-insensitive, normalized)
        for (const token of tokens) {
            const normalizedToken = this.normalizeToken(token);
            if (this.isSignificantToken(normalizedToken)) {
                tokenCounts.set(normalizedToken, (tokenCounts.get(normalizedToken) || 0) + 1);
            }
        }
        
        // Calculate dynamic threshold based on text length
        const dynamicThreshold = config.baseThreshold + 
            Math.floor(originalLength / config.dynamicThresholdDivisor) * config.lengthFactor;
        
        let result = text;
        
        // Reduce excessive repetitions
        for (const [normalizedToken, count] of tokenCounts) {
            if (count >= dynamicThreshold) {
                const keepCount = Math.max(1, Math.floor(count * config.shortCharKeepRatio));
                const reductionNeeded = count - keepCount;
                
                // Create escape pattern for regex
                const escapedToken = this.escapeRegex(normalizedToken);
                const tokenRegex = new RegExp(`\\b${escapedToken}\\b`, 'gi');
                
                // Remove excess occurrences
                let removed = 0;
                result = result.replace(tokenRegex, (match) => {
                    removed++;
                    return removed <= reductionNeeded ? '' : match;
                });
                
                if (removed > 0) changes++;
            }
        }
        
        return { text: result, changes };
    }
    
    /**
     * Suppress sentence repetitions using structural similarity
     */
    private suppressSentenceRepetitions(text: string): { text: string; changes: number } {
        const config = CLEANING_CONFIG.repetition;
        let changes = 0;
        
        // Split into sentences using universal punctuation
        const sentences = this.splitIntoSentences(text);
        const result: string[] = [];
        const seenSentences = new Map<string, number>();
        
        for (const sentence of sentences) {
            const normalizedSentence = this.normalizeSentence(sentence);
            
            if (normalizedSentence.length >= config.minimumSentenceLengthForSimilarity) {
                const count = seenSentences.get(normalizedSentence) || 0;
                seenSentences.set(normalizedSentence, count + 1);
                
                // Only keep if under repetition threshold
                if (count + 1 <= config.sentenceRepetition) {
                    result.push(sentence);
                } else {
                    changes++;
                }
            } else {
                // Always keep short sentences
                result.push(sentence);
            }
        }
        
        return { text: result.join(''), changes };
    }
    
    /**
     * Compress enumeration patterns (A,B,A,B... -> A,B)
     */
    private compressEnumerations(text: string): { text: string; changes: number } {
        const config = CLEANING_CONFIG.repetition.enumerationDetection;
        let changes = 0;
        
        // Split by sentences and process each
        const sentences = this.splitIntoSentences(text);
        const result = sentences.map(sentence => {
            // Detect common separators
            const separators = [',', ';', '、', '·', '\t', /\s{2,}/];
            
            for (const sep of separators) {
                const sepRegex = sep instanceof RegExp ? sep : new RegExp(`\\s*${this.escapeRegex(sep)}\\s*`);
                
                // Check if sentence contains this separator
                if (sepRegex.test(sentence)) {
                    const parts = sentence.split(sepRegex);
                    
                    if (parts.length >= config.minRepeatCount * 2) {
                        const compressed = this.detectAndCompressPattern(parts, config.minRepeatCount);
                        if (compressed.changed) {
                            changes++;
                            const sepStr = sep instanceof RegExp ? ' ' : (sep === '、' ? '、' : `${sep} `);
                            return compressed.parts.join(sepStr) + 
                                (sentence.match(/[。.!?！？]+$/) ? sentence.match(/[。.!?！？]+$/)?.[0] || '' : '');
                        }
                    }
                }
            }
            
            return sentence;
        });
        
        return { text: result.join(''), changes };
    }
    
    /**
     * Suppress paragraph repetitions using fingerprinting
     */
    private suppressParagraphRepetitions(text: string): { text: string; changes: number } {
        const config = CLEANING_CONFIG.repetition.paragraphRepeat;
        let changes = 0;
        
        const paragraphs = text.split(/\n\s*\n/);
        const seenFingerprints = new Set<string>();
        const result: string[] = [];
        
        for (const paragraph of paragraphs) {
            const trimmed = paragraph.trim();
            if (trimmed.length === 0) continue;
            
            // Create fingerprint from first N characters
            const fingerprint = this.normalizeSentence(trimmed.slice(0, config.headChars));
            
            if (!seenFingerprints.has(fingerprint)) {
                seenFingerprints.add(fingerprint);
                result.push(paragraph);
            } else {
                changes++;
            }
        }
        
        return { text: result.join('\n\n'), changes };
    }
    
    /**
     * Suppress tail repetitions (high self-repetition density at end)
     */
    private suppressTailRepetitions(text: string): { text: string; changes: number } {
        let changes = 0;
        
        // Analyze last 400 characters for repetition density
        const tailLength = Math.min(400, text.length);
        if (tailLength < 80) return { text, changes };
        
        const tail = text.slice(-tailLength);
        const diversity = this.calculateLexicalDiversity(tail);
        const repetitionDensity = this.calculateRepetitionDensity(tail);
        
        // If tail has low diversity or high repetition, cut back to last sentence
        if (diversity < 0.3 || repetitionDensity >= 2) {
            const cutPoint = text.length - tailLength;
            const beforeTail = text.slice(0, cutPoint);
            
            // Find last sentence boundary
            const sentenceEnds = ['.', '。', '!', '！', '?', '？'];
            let lastSentenceEnd = -1;
            
            for (let i = beforeTail.length - 1; i >= 0; i--) {
                if (sentenceEnds.includes(beforeTail[i])) {
                    lastSentenceEnd = i;
                    break;
                }
            }
            
            if (lastSentenceEnd > 0) {
                changes++;
                return { text: beforeTail.slice(0, lastSentenceEnd + 1), changes };
            }
        }
        
        return { text, changes };
    }
    
    /**
     * Final cleanup of the text
     */
    private finalCleanup(text: string): string {
        return text
            .replace(/\uFFFD+/g, '')  // Remove replacement characters
            .replace(/\n{3,}/g, '\n\n')  // Normalize line breaks
            .trim();
    }
    
    // Helper methods
    
    private tokenizeText(text: string): string[] {
        // Universal tokenization: split on whitespace and punctuation
        // Handle CJK characters as individual tokens when needed
        return Array.from(text.matchAll(/\p{L}+|\p{N}+|\p{P}+|\s+/gu), m => m[0]);
    }
    
    private normalizeToken(token: string): string {
        return token.normalize('NFKC').toLowerCase().trim();
    }
    
    private isSignificantToken(token: string): boolean {
        // Skip pure punctuation, whitespace, and very short tokens
        return token.length > 0 && 
               !/^\p{P}+$|^\s+$|^[、。.!?！？…]+$/u.test(token) &&
               token.length >= 2;
    }
    
    private splitIntoSentences(text: string): string[] {
        // Universal sentence splitting using common punctuation
        return text.split(/(?<=[。.!?！？])\s*/);
    }
    
    private normalizeSentence(sentence: string): string {
        return sentence
            .replace(/[、。,.;:!！?？\s]/g, '')
            .normalize('NFKC')
            .toLowerCase();
    }
    
    private escapeRegex(str: string): string {
        return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
    
    private detectAndCompressPattern(parts: string[], minRepeat: number): { parts: string[]; changed: boolean } {
        // Try different pattern lengths
        for (let patternLength = 2; patternLength <= Math.floor(parts.length / minRepeat); patternLength++) {
            const pattern = parts.slice(0, patternLength);
            let matches = 1;
            
            // Check how many times this pattern repeats
            for (let i = patternLength; i < parts.length; i += patternLength) {
                const candidate = parts.slice(i, i + patternLength);
                if (this.arraysEqual(pattern, candidate)) {
                    matches++;
                } else {
                    break;
                }
            }
            
            if (matches >= minRepeat) {
                return { parts: pattern, changed: true };
            }
        }
        
        return { parts, changed: false };
    }
    
    private arraysEqual(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }
    
    private calculateLexicalDiversity(text: string): number {
        const tokens = this.tokenizeText(text).filter(t => this.isSignificantToken(this.normalizeToken(t)));
        const uniqueTokens = new Set(tokens.map(t => this.normalizeToken(t)));
        return tokens.length > 0 ? uniqueTokens.size / tokens.length : 1;
    }
    
    private calculateRepetitionDensity(text: string): number {
        // Count overlapping repetitive patterns
        const repetitions = (text.match(/(.{2,20})\1{2,}/gs) || []).length;
        return repetitions;
    }
}