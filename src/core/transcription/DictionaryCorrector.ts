
import { CorrectionRule, DictionaryCorrectorOptions, ITextCorrector, SimpleCorrectionDictionary, CorrectionEntry } from '../../interfaces';
import { TranscriptionError, TranscriptionErrorType } from '../../errors';
import { API_CONSTANTS, DICTIONARY_CONSTANTS } from '../../config';

/**
 * 辞書修正設定
 * 
 * CLAUDE.mdの哲学に従った設計:
 * - シンプルな固定置換のみをサポート
 */
export interface DictionarySettings {
    enabled: boolean;
    customRules: CorrectionRule[];
    correctionDictionary?: SimpleCorrectionDictionary;
}

export class DictionaryCorrector implements ITextCorrector {
    private settings: DictionarySettings;
    private correctionDictionary: SimpleCorrectionDictionary;
    
    // Common Japanese transcription errors (empty by default - users can add their own)
    private defaultRules: CorrectionRule[] = [];

    constructor(settings?: Partial<DictionarySettings>) {
        this.settings = {
            enabled: true,
            customRules: [],
            ...settings
        };
        // Initialize correction dictionary
        this.correctionDictionary = settings?.correctionDictionary || {
            definiteCorrections: []
        };
    }

    async correct(text: string): Promise<string> {
        if (!this.settings.enabled) {
            return text;
        }
        
        // 空文字または短すぎるテキストは処理しない
        if (!text || text.trim().length < 2) {
            return text;
        }

        // Apply rule-based corrections
        const correctedText = this.applyRules(text);
        
        return correctedText;
    }

    private applyRules(text: string): string {
        let result = text;
        
        // Apply default rules
        for (const rule of this.defaultRules) {
            result = this.applyRule(result, rule);
        }
        
        // Apply custom rules
        for (const rule of this.settings.customRules) {
            result = this.applyRule(result, rule);
        }
        
        // Apply dictionary corrections
        for (const correction of this.correctionDictionary.definiteCorrections) {
            // Handle multiple patterns per correction
            for (const pattern of correction.from) {
                if (result.includes(pattern)) {
                    result = result.replace(
                        new RegExp(this.escapeRegExp(pattern), 'g'),
                        correction.to
                    );
                }
            }
        }
        
        return result;
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private applyRule(text: string, rule: CorrectionRule): string {
        if (typeof rule.pattern === 'string') {
            const flags = rule.caseSensitive ? 'g' : 'gi';
            const regex = new RegExp(rule.pattern, flags);
            return text.replace(regex, rule.replacement);
        } else {
            return text.replace(rule.pattern, rule.replacement);
        }
    }

    updateSettings(settings: Partial<DictionarySettings>): void {
        this.settings = { ...this.settings, ...settings };
        if (settings.correctionDictionary) {
            this.correctionDictionary = {
                ...this.correctionDictionary,
                ...settings.correctionDictionary
            };
        }
    }

    /**
     * Update correction dictionary
     */
    updateCorrectionDictionary(dictionary: Partial<SimpleCorrectionDictionary>): void {
        this.correctionDictionary = {
            ...this.correctionDictionary,
            ...dictionary
        };
    }

    /**
     * Add custom correction entry
     */
    addCorrectionEntry(entry: CorrectionEntry, contextual: boolean = false): void {
        // Contextual corrections are not yet implemented
        // For now, all corrections are added as definite corrections
        this.correctionDictionary.definiteCorrections.push(entry);
    }

    addCustomRule(rule: CorrectionRule): void {
        this.settings.customRules.push(rule);
    }

    removeCustomRule(index: number): void {
        this.settings.customRules.splice(index, 1);
    }

    getSettings(): DictionarySettings {
        return { ...this.settings };
    }

    getDefaultRules(): CorrectionRule[] {
        return [...this.defaultRules];
    }
}
