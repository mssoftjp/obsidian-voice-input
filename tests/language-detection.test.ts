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
): 'ja' | 'zh' | 'ko' | 'en' {
    if (!['ja', 'zh', 'ko', 'en'].includes(pluginLanguage)) {
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

        // auto は廃止済みのためテストしない

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
            transcriptionLanguage: string | undefined,
            advanced: { languageLinkingEnabled?: boolean; transcriptionLanguage?: string } | undefined,
            detectFn: () => 'ja' | 'zh' | 'ko' | 'en'
        ): 'ja' | 'zh' | 'ko' | 'en' {
            if (advanced?.languageLinkingEnabled === false) {
                const adv = advanced?.transcriptionLanguage;
                return (['ja', 'zh', 'ko', 'en'].includes(adv as any) ? adv : detectFn()) as 'ja' | 'zh' | 'ko' | 'en';
            }
            return (['ja', 'zh', 'ko', 'en'].includes(transcriptionLanguage as any) ? transcriptionLanguage : detectFn()) as 'ja' | 'zh' | 'ko' | 'en';
        }

        test('should use TL when linking enabled; fallback to detection when missing/invalid', () => {
            // Default case: advanced.languageLinkingEnabled is true
            const advanced = { languageLinkingEnabled: true };
            
            // Should use transcriptionLanguage when it's not 'auto'
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('ja');
            expect(mockDetectFn).not.toHaveBeenCalled();

            // Missing or invalid TL falls back to detection
            expect(getResolvedLanguageAdvanced(undefined, advanced, mockDetectFn)).toBe('ko');
            expect(getResolvedLanguageAdvanced('invalid', advanced, mockDetectFn)).toBe('ko');
        });

        test('should treat undefined advanced as linking enabled', () => {
            // When advanced is undefined, should default to traditional behavior (linking enabled)
            expect(getResolvedLanguageAdvanced('ja', undefined, mockDetectFn)).toBe('ja');
            expect(mockDetectFn).not.toHaveBeenCalled();

            expect(getResolvedLanguageAdvanced(undefined, undefined, mockDetectFn)).toBe('ko');
            expect(mockDetectFn).toHaveBeenCalledTimes(1);
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

        test('should use advanced TL when linking disabled; fallback to detection when missing/invalid', () => {
            const advanced = { 
                languageLinkingEnabled: false, 
                transcriptionLanguage: undefined as unknown as string
            };
            
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('ko');
            expect(mockDetectFn).toHaveBeenCalled();
        });

        test('should use detection when linking disabled and advanced TL is undefined', () => {
            const advanced = { 
                languageLinkingEnabled: false
                // transcriptionLanguage is undefined
            };
            
            expect(getResolvedLanguageAdvanced('ja', advanced, mockDetectFn)).toBe('ko');
            expect(mockDetectFn).toHaveBeenCalled();
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
