/**
 * Tests for locale detection functionality
 * Validates getObsidianLocale() function with different Obsidian app configurations
 */

import { getObsidianLocale } from '../../../src/types/obsidian-internal';
import { App } from 'obsidian';

// Mock Obsidian's moment export
jest.mock('obsidian', () => ({
    ...jest.requireActual('obsidian'),
    moment: {
        locale: jest.fn()
    }
}));

// Import moment after mocking
import { moment } from 'obsidian';

describe('Locale Detection', () => {
    beforeEach(() => {
        // Reset mocks
        (moment.locale as jest.Mock).mockReset();
    });

    describe('getObsidianLocale() function', () => {
        it('should detect ja-JP locale from vault config', () => {
            const mockApp = {
                vault: {
                    config: {
                        locale: 'ja-JP'
                    }
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('ja-jp');
        });

        it('should detect en-US locale from vault config', () => {
            const mockApp = {
                vault: {
                    config: {
                        locale: 'en-US'
                    }
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('en-us');
        });

        it('should detect zh-CN locale from vault config', () => {
            const mockApp = {
                vault: {
                    config: {
                        locale: 'zh-CN'
                    }
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('zh-cn');
        });

        it('should detect ko-KR locale from vault config', () => {
            const mockApp = {
                vault: {
                    config: {
                        locale: 'ko-KR'
                    }
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('ko-kr');
        });

        it('should fallback to app.locale when vault config is not available', () => {
            const mockApp = {
                locale: 'ja-JP',
                vault: {
                    config: {}
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('ja-jp');
        });

        it('should fallback to moment.locale() when app locale is not available', () => {
            (moment.locale as jest.Mock).mockReturnValue('zh-CN');
            
            const mockApp = {
                vault: {
                    config: {}
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('zh-cn');
            expect(moment.locale).toHaveBeenCalled();
        });

        it('should fallback to "en" when no locale is available', () => {
            (moment.locale as jest.Mock).mockReturnValue(undefined);
            
            const mockApp = {
                vault: {
                    config: {}
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('en');
        });

        it('should normalize locale codes to lowercase', () => {
            const testCases = [
                { input: 'JA-JP', expected: 'ja-jp' },
                { input: 'EN-US', expected: 'en-us' },
                { input: 'ZH-CN', expected: 'zh-cn' },
                { input: 'KO-KR', expected: 'ko-kr' },
                { input: 'Fr-FR', expected: 'fr-fr' },
                { input: 'DE', expected: 'de' }
            ];

            testCases.forEach(({ input, expected }) => {
                const mockApp = {
                    vault: {
                        config: {
                            locale: input
                        }
                    }
                } as App;

                const result = getObsidianLocale(mockApp);
                expect(result).toBe(expected);
            });
        });

        it('should handle missing vault property gracefully', () => {
            (moment.locale as jest.Mock).mockReturnValue('en-US');
            
            const mockApp = {} as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('en-us');
        });

        it('should handle null/undefined moment locale gracefully', () => {
            (moment.locale as jest.Mock).mockReturnValue(null);
            
            const mockApp = {
                vault: {
                    config: {}
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('en');
        });

        it('should prioritize vault config over app locale', () => {
            const mockApp = {
                locale: 'en-US', // This should be ignored
                vault: {
                    config: {
                        locale: 'ja-JP' // This should take priority
                    }
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('ja-jp');
        });

        it('should prioritize app locale over moment locale', () => {
            (moment.locale as jest.Mock).mockReturnValue('ko-KR'); // This should be ignored
            
            const mockApp = {
                locale: 'zh-CN', // This should take priority
                vault: {
                    config: {}
                }
            } as App;

            const result = getObsidianLocale(mockApp);
            expect(result).toBe('zh-cn');
        });
    });

    describe('Locale integration scenarios', () => {
        it('should handle complex locale codes correctly', () => {
            const complexLocales = [
                { input: 'ja-JP-u-ca-japanese', expected: 'ja-jp-u-ca-japanese' },
                { input: 'en-US-POSIX', expected: 'en-us-posix' },
                { input: 'zh-Hans-CN', expected: 'zh-hans-cn' },
                { input: 'ko-Kore-KR', expected: 'ko-kore-kr' }
            ];

            complexLocales.forEach(({ input, expected }) => {
                const mockApp = {
                    vault: {
                        config: {
                            locale: input
                        }
                    }
                } as App;

                const result = getObsidianLocale(mockApp);
                expect(result).toBe(expected);
            });
        });

        it('should handle various fallback chains correctly', () => {
            // Test the full fallback chain: vault.config.locale → app.locale → moment.locale() → 'en'
            const fallbackChains = [
                {
                    name: 'vault config available',
                    mockApp: { vault: { config: { locale: 'ja-JP' } } },
                    momentReturn: 'en-US',
                    expected: 'ja-jp'
                },
                {
                    name: 'app locale available',
                    mockApp: { locale: 'zh-CN', vault: { config: {} } },
                    momentReturn: 'en-US',
                    expected: 'zh-cn'
                },
                {
                    name: 'moment locale available',
                    mockApp: { vault: { config: {} } },
                    momentReturn: 'ko-KR',
                    expected: 'ko-kr'
                },
                {
                    name: 'default fallback',
                    mockApp: { vault: { config: {} } },
                    momentReturn: undefined,
                    expected: 'en'
                }
            ];

            fallbackChains.forEach(({ name, mockApp, momentReturn, expected }) => {
                (moment.locale as jest.Mock).mockReturnValue(momentReturn);
                
                const result = getObsidianLocale(mockApp as App);
                expect(result).toBe(expected);
            });
        });
    });
});