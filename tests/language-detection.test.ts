import { getObsidianLocale } from '../src/types';

// Mock to test language detection logic
jest.mock('../src/types', () => ({
    getObsidianLocale: jest.fn()
}));

// Extract the detection logic for isolated testing
function detectPluginLanguage(getObsidianLocaleFn: () => string): 'ja' | 'zh' | 'ko' | 'en' {
    const obsidianLocale = getObsidianLocaleFn().toLowerCase();

    if (obsidianLocale.startsWith('ja')) {
        return 'ja';
    } else if (obsidianLocale.startsWith('zh')) {
        return 'zh';
    } else if (obsidianLocale.startsWith('ko')) {
        return 'ko';
    } else {
        return 'en';
    }
}

function getResolvedLanguage(
    pluginLanguage: string, 
    detectFn: () => 'ja' | 'zh' | 'ko' | 'en'
): 'auto' | 'ja' | 'zh' | 'ko' | 'en' {
    if (pluginLanguage === 'auto') {
        // 仕様変更: 'auto' はそのまま返す（API に渡す）
        return 'auto';
    }

    if (!['ja', 'zh', 'ko', 'en'].includes(pluginLanguage)) {
        // 不正値は従来通り検出へフォールバック
        return detectFn();
    }

    return pluginLanguage as 'ja' | 'zh' | 'ko' | 'en';
}

describe('Language Detection Logic', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('detectPluginLanguage', () => {
        test('should detect Japanese locale', () => {
            const mockGetObsidianLocale = jest.fn(() => 'ja-JP');
            const result = detectPluginLanguage(mockGetObsidianLocale);
            expect(result).toBe('ja');
        });

        test('should detect Chinese locale', () => {
            const mockGetObsidianLocale = jest.fn(() => 'zh-CN');
            const result = detectPluginLanguage(mockGetObsidianLocale);
            expect(result).toBe('zh');
        });

        test('should detect Korean locale', () => {
            const mockGetObsidianLocale = jest.fn(() => 'ko-KR');
            const result = detectPluginLanguage(mockGetObsidianLocale);
            expect(result).toBe('ko');
        });

        test('should default to English for unknown locales', () => {
            const mockGetObsidianLocale = jest.fn(() => 'fr-FR');
            const result = detectPluginLanguage(mockGetObsidianLocale);
            expect(result).toBe('en');
        });

        test('should handle case insensitive locale matching', () => {
            const mockGetObsidianLocale = jest.fn(() => 'ZH-TW');
            const result = detectPluginLanguage(mockGetObsidianLocale);
            expect(result).toBe('zh');
        });

        test('should handle edge cases', () => {
            const mockGetObsidianLocale = jest.fn(() => '');
            const result = detectPluginLanguage(mockGetObsidianLocale);
            expect(result).toBe('en');
        });
    });

    describe('getResolvedLanguage', () => {
        const mockDetectFn = jest.fn(() => 'ko' as const);

        beforeEach(() => {
            mockDetectFn.mockClear();
        });

        test('should return plugin language when set to valid value', () => {
            const result = getResolvedLanguage('ja', mockDetectFn);
            expect(result).toBe('ja');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });

        test('should fall back to auto-detection for invalid plugin language', () => {
            const result = getResolvedLanguage('invalid', mockDetectFn);
            expect(result).toBe('ko');
            expect(mockDetectFn).toHaveBeenCalledTimes(1);
        });

        test('should handle auto value (pass-through)', () => {
            const result = getResolvedLanguage('auto', mockDetectFn);
            expect(result).toBe('auto');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });

        test('should work with all supported languages', () => {
            expect(getResolvedLanguage('ja', mockDetectFn)).toBe('ja');
            expect(getResolvedLanguage('zh', mockDetectFn)).toBe('zh');
            expect(getResolvedLanguage('ko', mockDetectFn)).toBe('ko');
            expect(getResolvedLanguage('en', mockDetectFn)).toBe('en');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });
    });

    describe('getResolvedLanguageWithAdvancedSettings', () => {
        const mockDetectFn = jest.fn(() => 'ko' as const);

        beforeEach(() => {
            mockDetectFn.mockClear();
        });

        // Function to simulate the new advanced language resolution logic
        function getResolvedLanguageAdvanced(
            transcriptionLanguage: string,
            advanced: { languageLinkingEnabled?: boolean; transcriptionLanguage?: string } | undefined,
            detectFn: () => 'ja' | 'zh' | 'ko' | 'en'
        ): 'auto' | 'ja' | 'zh' | 'ko' | 'en' {
            // 高度設定で言語連動が無効な場合: advanced.transcriptionLanguage を優先
            if (advanced?.languageLinkingEnabled === false) {
                const advancedLang = advanced.transcriptionLanguage ?? 'auto';
                return (advancedLang as 'auto' | 'ja' | 'zh' | 'ko' | 'en');
            }

            // 言語連動が有効な場合（デフォルト）: 通常の transcriptionLanguage を使用
            if (transcriptionLanguage === 'auto') {
                return 'auto';
            }
            return transcriptionLanguage as 'ja' | 'zh' | 'ko' | 'en';
        }

        test('should return auto when linking is enabled and TL is auto', () => {
            // Default case: advanced.languageLinkingEnabled is true
            const advanced = { languageLinkingEnabled: true };
            
            // Should use transcriptionLanguage when it's not 'auto'
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('ja');
            expect(mockDetectFn).not.toHaveBeenCalled();

            // Should pass through 'auto'
            expect(getResolvedLanguageAdvanced('auto', advanced, mockDetectFn)).toBe('auto');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });

        test('should treat undefined advanced as linking enabled', () => {
            // When advanced is undefined, should default to traditional behavior (linking enabled)
            expect(getResolvedLanguageAdvanced('ja', undefined, mockDetectFn)).toBe('ja');
            expect(mockDetectFn).not.toHaveBeenCalled();

            expect(getResolvedLanguageAdvanced('auto', undefined, mockDetectFn)).toBe('auto');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });

        test('should use advanced.transcriptionLanguage when language linking is disabled', () => {
            const advanced = { 
                languageLinkingEnabled: false, 
                transcriptionLanguage: 'en'
            };
            
            // Should ignore the regular transcriptionLanguage and use advanced.transcriptionLanguage
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('en');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });

        test('should pass through auto when linking disabled and advanced TL is auto', () => {
            const advanced = { 
                languageLinkingEnabled: false, 
                transcriptionLanguage: 'auto'
            };
            
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('auto');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });

        test('should pass through auto when linking disabled and advanced TL is undefined', () => {
            const advanced = { 
                languageLinkingEnabled: false
                // transcriptionLanguage is undefined
            };
            
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('auto');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });

        test('should work with all supported languages in advanced mode', () => {
            const advanced = { 
                languageLinkingEnabled: false, 
                transcriptionLanguage: 'zh'
            };
            
            // Test all supported languages
            advanced.transcriptionLanguage = 'ja';
            expect(getResolvedLanguageAdvanced('en', advanced, mockDetectFn)).toBe('ja');
            
            advanced.transcriptionLanguage = 'zh';
            expect(getResolvedLanguageAdvanced('en', advanced, mockDetectFn)).toBe('zh');
            
            advanced.transcriptionLanguage = 'ko';
            expect(getResolvedLanguageAdvanced('en', advanced, mockDetectFn)).toBe('ko');
            
            advanced.transcriptionLanguage = 'en';
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('en');
            
            expect(mockDetectFn).not.toHaveBeenCalled();
        });
    });
});
