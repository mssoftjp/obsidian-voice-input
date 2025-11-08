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
        
        const { instructionPatterns, contextPatterns, promptSnippetLengths } = 
            CLEANING_CONFIG.contamination;
        
        // Step 1: Handle XML tags (highest priority)
        cleaned = this.removeXmlTags(cleaned);
        if (cleaned !== text) {
            patternsMatched++;
            this.logger.debug('XML tags removed');
        }
        
        // Step 2: Remove leading prompt block (multi-line instructions at the very beginning)
        const beforeInstructions = cleaned;
        cleaned = this.removeLeadingPromptBlock(cleaned, instructionPatterns);
        // Also apply exact instruction matches for residuals
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

        // Step 6: Final safeguard — remove any leftover exact instruction phrases anywhere (very conservative list)
        // This catches cases where punctuation or line breaks prevented earlier head-only removal.
        for (const pattern of instructionPatterns) {
            try {
                const escaped = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const anywhere = new RegExp(`${escaped}(?:[\u3002\.：:])?`, 'gi');
                cleaned = cleaned.replace(anywhere, '');
            } catch {
                // ignore
            }
        }
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
     * Remove XML tags using fixed patterns for TRANSCRIPT tags
     */
    private removeXmlTags(text: string): string {
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
     * Remove consecutive instruction/context lines at the very beginning (until a non-instruction line appears)
     */
    private removeLeadingPromptBlock(text: string, instructionPatterns: string[]): string {
        const lines = text.split(/\r?\n/);
        let cutIndex = 0;

        // Build quick regexes for instructions and context labels across languages
        const escapedInstructions = instructionPatterns.map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        // Identify a line as instruction if it STARTS with an instruction phrase (rest of line may include more prompts)
        const instructionRegexes = escapedInstructions.map(e => new RegExp(`^\s*${e}`, 'i'));
        const contextRegexes: RegExp[] = [
            /^\s*Output\s*format\s*:?\s*$/i,
            /^\s*Format\s*:?\s*$/i,
            /^\s*出力形式\s*:?\s*$/,
            /^\s*输出格式\s*:?\s*$/,
            /^\s*출력\s*형식\s*:?\s*$/,
            /^\s*\(Speaker\s+content\s+only\)\s*$/i,
            /^\s*（話者の発言のみ）\s*$/,
            /^\s*（仅说话者内容）\s*$/,
            /^\s*（화자\s*발언만）\s*$/
        ];

        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            const trimmed = ln.trim();
            if (trimmed.length === 0) { cutIndex = i + 1; continue; }
            const isInstruction = instructionRegexes.some(r => r.test(trimmed));
            const isContext = contextRegexes.some(r => r.test(trimmed));
            if (isInstruction || isContext) {
                cutIndex = i + 1;
                continue;
            }
            // stop when encountering first non-instruction/context line
            break;
        }

        return lines.slice(cutIndex).join('\n');
    }
    
    /**
     * Remove instruction patterns from the beginning of text
     */
    private removeInstructionPatterns(text: string, instructionPatterns: string[]): string {
        let cleaned = text;
        let changed = true;
        // Greedily remove any known instruction that appears at the very beginning (allowing optional punctuation right after)
        while (changed) {
            changed = false;
            for (const pattern of instructionPatterns) {
                const escaped = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                // Match at start of string or start of any line (multiline), forgiving trailing punctuation
                const reg = new RegExp(`^\\s*${escaped}(?:[\u3002\.：:])?\\s*`, 'im');
                const before = cleaned;
                cleaned = cleaned.replace(reg, '');
                if (cleaned !== before) {
                    changed = true;
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
        // Restrict snippet search to head region to minimize false positives
        const MAX_SNIPPET_SEARCH_CHARS = 300;
        const head = cleaned.slice(0, MAX_SNIPPET_SEARCH_CHARS);
        let headMut = head;
        
        // Multilingual suffix lexicon for enhanced snippet detection (added JA)
        const suffixLexicon = [
            /\b(please|do\s*not\s*include|only|content|output\s*format)\b/gi, // EN
            /(请|請|不要|仅|只|内容|输出格式|輸出格式)/g,                                // ZH
            /(해주세요|하지\s*마세요|포함하지\s*마세요|만|내용|출력\s*형식)/g,            // KO
            /(この指示文|指示文|出力形式|形式|内容|話者|のみ|含めないでください|含めないで)$/g // JA
        ];
        
        for (const pattern of instructionPatterns) {
            for (const length of snippetLengths) {
                if (pattern.length < length) continue;
                
                const snippet = pattern.slice(0, length);
                // Escape special regex characters
                const escapedSnippet = snippet.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                
                // Enhanced multilingual contextual matching (head region only)
                for (const suffixPattern of suffixLexicon) {
                    const contextRegex = new RegExp(
                        `${escapedSnippet}[^。.!?！？\\n]{0,50}(${suffixPattern.source})`,
                        suffixPattern.flags
                    );
                    headMut = headMut.replace(contextRegex, '');
                }
                
                // Legacy pattern for Japanese (apply once within head)
                const legacyJapaneseRegex = new RegExp(
                    `${escapedSnippet}[^。.!?！？\\n]{0,50}(?:ください|してください|です|ます)(?![\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF])`,
                    'i'
                );
                headMut = headMut.replace(legacyJapaneseRegex, '');
            }
        }
        // Apply head mutations back to full text
        cleaned = headMut + cleaned.slice(head.length);
        return cleaned;
    }
    
    /**
     * Apply context patterns for general cleanup
     */
    private removeContextPatterns(text: string, contextPatterns: string[]): string {
        let cleaned = text;

        // 1) Apply patterns from configuration (strings like '/.../flags')
        const compiled: RegExp[] = [];
        for (const p of contextPatterns) {
            try {
                const match = p.match(/^\/(.*)\/([gimsuy]*)$/);
                if (match) {
                    const [, body, flags] = match;
                    compiled.push(new RegExp(body, flags || 'g'));
                }
            } catch {
                // ignore invalid patterns
            }
        }
        for (const r of compiled) cleaned = cleaned.replace(r, '');

        // 2) Built-in safe patterns
        const speakerPatterns = [
            /\(Speaker content only\)/gi,
            /\(SPEAKER CONTENT ONLY\)/gi,
            /（話者の発言のみ）/g,
            /（仅说话者内容）/g,
            /（화자 발언만）/g
        ];
        for (const pattern of speakerPatterns) cleaned = cleaned.replace(pattern, '');

        const formatPatterns = [
            /^Output format:\s*$/gm,
            /^Format:\s*$/gm,
            /^出力形式:\s*$/gm,
            /^输出格式:\s*$/gm,
            /^출력 형식:\s*$/gm
        ];
        for (const pattern of formatPatterns) cleaned = cleaned.replace(pattern, '');

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
