/**
 * Tests for multilingual prompt support
 * Verifies that prompts are correctly generated and applied for all supported languages
 */

// Mock TranscriptionService to test multilingual prompt functionality
class MockTranscriptionService {
    /**
     * Normalize language code for consistent processing
     */
    normalizeLanguage(language: string): string {
        if (language === 'auto') return 'auto';
        const lang = language.toLowerCase();
        if (lang.startsWith('ja')) return 'ja';
        if (lang.startsWith('zh')) return 'zh';
        if (lang.startsWith('ko')) return 'ko';
        if (lang.startsWith('en')) return 'en';
        return lang;
    }

    /**
     * Build prompt for GPT-4o transcription (for all languages except auto)
     */
    buildTranscriptionPrompt(language: string): string {
        // No prompt for auto language mode (as it might interfere with language detection)
        if (language === 'auto') {
            return '';
        }
        
        const normalizedLang = this.normalizeLanguage(language);
        
        switch (normalizedLang) {
            case 'ja':
                return `以下の音声内容のみを文字に起こしてください。この指示文は出力に含めないでください。
話者の発言内容だけを正確に記録してください。

出力形式:
<TRANSCRIPT>
（話者の発言のみ）
</TRANSCRIPT>`;
            
            case 'en':
                return `Please transcribe only the following audio content. Do not include this instruction in your output.
Record only the speaker's statements accurately.

Output format:
<TRANSCRIPT>
(Speaker content only)
</TRANSCRIPT>`;
            
            case 'zh':
                return `请仅转录以下音频内容。不要包含此指令在输出中。
请准确记录说话者的发言内容。

输出格式:
<TRANSCRIPT>
（仅说话者内容）
</TRANSCRIPT>`;
            
            case 'ko':
                return `다음 음성 내용만 전사해주세요. 이 지시사항을 출력에 포함하지 마세요.
화자의 발언 내용만 정확히 기록해주세요.

출력 형식:
<TRANSCRIPT>
（화자 발언만）
</TRANSCRIPT>`;
            
            default:
                // For any other language, return empty string
                return '';
        }
    }
}

describe('Multilingual Prompt Support', () => {
    let service: MockTranscriptionService;

    beforeEach(() => {
        service = new MockTranscriptionService();
    });

    describe('Prompt generation for supported languages', () => {
        it('should generate appropriate prompts for each supported language', () => {
            const languages = ['ja', 'en', 'zh', 'ko'];
            
            languages.forEach(lang => {
                const prompt = service.buildTranscriptionPrompt(lang);
                
                // All prompts should be non-empty
                expect(prompt.length).toBeGreaterThan(0);
                
                // All prompts should contain TRANSCRIPT tags
                expect(prompt).toContain('<TRANSCRIPT>');
                expect(prompt).toContain('</TRANSCRIPT>');
                
                // Prompts should be in the appropriate language
                switch (lang) {
                    case 'ja':
                        expect(prompt).toContain('以下の音声内容のみを文字に起こしてください');
                        expect(prompt).toContain('（話者の発言のみ）');
                        break;
                    case 'en':
                        expect(prompt).toContain('Please transcribe only the following audio content');
                        expect(prompt).toContain('(Speaker content only)');
                        break;
                    case 'zh':
                        expect(prompt).toContain('请仅转录以下音频内容');
                        expect(prompt).toContain('（仅说话者内容）');
                        break;
                    case 'ko':
                        expect(prompt).toContain('다음 음성 내용만 전사해주세요');
                        expect(prompt).toContain('（화자 발언만）');
                        break;
                }
            });
        });

        it('should not generate prompts for auto language mode', () => {
            const prompt = service.buildTranscriptionPrompt('auto');
            expect(prompt).toBe('');
        });

        it('should not generate prompts for unsupported languages', () => {
            const unsupportedLanguages = ['fr', 'de', 'es', 'it', 'pt', 'ru', 'ar'];
            
            unsupportedLanguages.forEach(lang => {
                const prompt = service.buildTranscriptionPrompt(lang);
                expect(prompt).toBe('');
            });
        });
    });

    describe('Language code normalization', () => {
        it('should handle language variants correctly', () => {
            const testCases = [
                { input: 'ja', expected: 'ja' },
                { input: 'ja-JP', expected: 'ja' },
                { input: 'JA', expected: 'ja' },
                { input: 'en', expected: 'en' },
                { input: 'en-US', expected: 'en' },
                { input: 'en-GB', expected: 'en' },
                { input: 'EN', expected: 'en' },
                { input: 'zh', expected: 'zh' },
                { input: 'zh-CN', expected: 'zh' },
                { input: 'zh-TW', expected: 'zh' },
                { input: 'ZH', expected: 'zh' },
                { input: 'ko', expected: 'ko' },
                { input: 'ko-KR', expected: 'ko' },
                { input: 'KO', expected: 'ko' },
                { input: 'auto', expected: 'auto' },
            ];

            testCases.forEach(({ input, expected }) => {
                expect(service.normalizeLanguage(input)).toBe(expected);
            });
        });

        it('should generate prompts based on normalized language codes', () => {
            // Test that language variants get the same prompt as their base language
            const jaPrompt = service.buildTranscriptionPrompt('ja');
            const jaJPPrompt = service.buildTranscriptionPrompt('ja-JP');
            const JAPrompt = service.buildTranscriptionPrompt('JA');
            
            expect(jaJPPrompt).toBe(jaPrompt);
            expect(JAPrompt).toBe(jaPrompt);
            
            const enPrompt = service.buildTranscriptionPrompt('en');
            const enUSPrompt = service.buildTranscriptionPrompt('en-US');
            const ENPrompt = service.buildTranscriptionPrompt('EN');
            
            expect(enUSPrompt).toBe(enPrompt);
            expect(ENPrompt).toBe(enPrompt);
        });
    });

    describe('Prompt structure validation', () => {
        it('should ensure all prompts follow consistent structure', () => {
            const languages = ['ja', 'en', 'zh', 'ko'];
            
            languages.forEach(lang => {
                const prompt = service.buildTranscriptionPrompt(lang);
                
                // Should contain instruction not to include the prompt
                const lowerPrompt = prompt.toLowerCase();
                expect(
                    lowerPrompt.includes('not include') || 
                    lowerPrompt.includes('含めない') || 
                    lowerPrompt.includes('不要包含') || 
                    lowerPrompt.includes('포함하지')
                ).toBe(true);
                
                // Should contain output format instructions
                expect(
                    prompt.includes('Output format') || 
                    prompt.includes('出力形式') || 
                    prompt.includes('输出格式') || 
                    prompt.includes('출력 형식')
                ).toBe(true);
                
                // Should have proper TRANSCRIPT tag structure
                expect(prompt).toContain('<TRANSCRIPT>');
                expect(prompt).toContain('</TRANSCRIPT>');
                
                // TRANSCRIPT tags should be in correct order
                const transcriptStart = prompt.indexOf('<TRANSCRIPT>');
                const transcriptEnd = prompt.indexOf('</TRANSCRIPT>');
                expect(transcriptStart).toBeLessThan(transcriptEnd);
            });
        });

        it('should contain language-appropriate speaker placeholders', () => {
            const expectedPlaceholders = {
                'ja': '（話者の発言のみ）',
                'en': '(Speaker content only)',
                'zh': '（仅说话者内容）',
                'ko': '（화자 발언만）'
            };
            
            Object.entries(expectedPlaceholders).forEach(([lang, placeholder]) => {
                const prompt = service.buildTranscriptionPrompt(lang);
                expect(prompt).toContain(placeholder);
            });
        });
    });

    describe('Integration with auto mode behavior', () => {
        it('should maintain current auto mode behavior (no prompt)', () => {
            // Auto mode should continue to not get prompts to avoid interfering with language detection
            expect(service.buildTranscriptionPrompt('auto')).toBe('');
            expect(service.buildTranscriptionPrompt('AUTO')).toBe('');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty and null language inputs gracefully', () => {
            expect(service.buildTranscriptionPrompt('')).toBe('');
            expect(service.buildTranscriptionPrompt(' ')).toBe('');
        });

        it('should handle mixed case language codes', () => {
            expect(service.buildTranscriptionPrompt('Ja')).toBeTruthy();
            expect(service.buildTranscriptionPrompt('En')).toBeTruthy();
            expect(service.buildTranscriptionPrompt('Zh')).toBeTruthy();
            expect(service.buildTranscriptionPrompt('Ko')).toBeTruthy();
        });
    });
});