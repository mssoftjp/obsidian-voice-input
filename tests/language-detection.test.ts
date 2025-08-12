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
    if (pluginLanguage === 'auto') {
        return detectFn();
    }

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

        test('should handle auto value', () => {
            const result = getResolvedLanguage('auto', mockDetectFn);
            expect(result).toBe('ko');
            expect(mockDetectFn).toHaveBeenCalledTimes(1);
        });

        test('should work with all supported languages', () => {
            expect(getResolvedLanguage('ja', mockDetectFn)).toBe('ja');
            expect(getResolvedLanguage('zh', mockDetectFn)).toBe('zh');
            expect(getResolvedLanguage('ko', mockDetectFn)).toBe('ko');
            expect(getResolvedLanguage('en', mockDetectFn)).toBe('en');
            expect(mockDetectFn).not.toHaveBeenCalled();
        });
    });
});