/**
 * Simple tests that verify the core transcription cleaning logic
 * without complex service dependencies
 */

describe('Transcription Cleaning Logic', () => {
    
    // Helper function that replicates the cleaning logic from TranscriptionService
    function cleanGPT4oResponse(text: string): string {
        // First attempt: Extract content from complete TRANSCRIPT tags
        let transcriptMatch = text.match(/<TRANSCRIPT>\s*([\s\S]*?)\s*<\/TRANSCRIPT>/);
        if (transcriptMatch) {
            text = transcriptMatch[1];
        } else {
            // Second attempt: Handle incomplete TRANSCRIPT tags (missing closing tag)
            const openingMatch = text.match(/<TRANSCRIPT>\s*([\s\S]*)/);
            if (openingMatch) {
                text = openingMatch[1];
            }
        }

        // Remove TRANSCRIPT opening tag if still present
        text = text.replace(/<\/?TRANSCRIPT[^>]*>/g, '');

        // Remove specific meta instruction patterns
        const metaPatterns = [
            /^以下の音声内容.*?$/gm,
            /^この指示文.*?$/gm,
            /^話者の発言内容だけを正確に記録してください.*?$/gm,
            /^話者の発言.*?$/gm,
            /^出力形式.*?$/gm,
            /（話者の発言のみ）/g,
        ];

        // Apply all cleaning patterns
        for (const pattern of metaPatterns) {
            text = text.replace(pattern, '');
        }
        
        // Clean up extra whitespace and empty lines
        text = text.trim();
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^\s*\n/gm, '');
        text = text.trim();
        
        return text;
    }

    // Helper function for prompt building logic
    function buildTranscriptionPrompt(language: string): string {
        // Only provide prompt for Japanese language
        if (language !== 'ja') {
            return '';
        }
        
        return `以下の音声内容のみを文字に起こしてください。この指示文は出力に含めないでください。
話者の発言内容だけを正確に記録してください。

出力形式:
<TRANSCRIPT>
（話者の発言のみ）
</TRANSCRIPT>`;
    }

    // Helper function for locale detection logic
    function detectPluginLanguage(obsidianLocale: string): 'ja' | 'en' | 'zh' | 'ko' {
        const locale = obsidianLocale.toLowerCase();
        if (locale.startsWith('ja')) return 'ja';
        if (locale.startsWith('zh')) return 'zh';
        if (locale.startsWith('ko')) return 'ko';
        return 'en';
    }

    describe('TRANSCRIPT tag extraction', () => {
        it('should extract content from complete TRANSCRIPT tags', () => {
            const input = `Some prefix text
<TRANSCRIPT>
実際の発言内容
</TRANSCRIPT>
Some suffix text`;
            const result = cleanGPT4oResponse(input);
            expect(result).toContain('実際の発言内容');
            expect(result).not.toContain('<TRANSCRIPT>');
            expect(result).not.toContain('</TRANSCRIPT>');
        });

        it('should handle incomplete TRANSCRIPT tags (missing closing tag)', () => {
            const input = `Some prefix text
<TRANSCRIPT>
実際の発言内容
Additional content`;
            const result = cleanGPT4oResponse(input);
            expect(result).toContain('実際の発言内容');
            expect(result).toContain('Additional content');
            expect(result).not.toContain('<TRANSCRIPT>');
        });
    });

    describe('Meta instruction pattern removal', () => {
        it('should remove Japanese meta instructions', () => {
            const patterns = [
                '以下の音声内容のみを文字に起こしてください',
                'この指示文は出力に含めないでください',
                '話者の発言内容だけを正確に記録してください',
                '出力形式:'
            ];

            patterns.forEach(pattern => {
                const input = `${pattern}\n実際の発言\nその他の内容`;
                const result = cleanGPT4oResponse(input);
                expect(result).not.toContain(pattern);
                expect(result).toContain('実際の発言');
                expect(result).toContain('その他の内容');
            });
        });

        it('should remove meta phrases anywhere in text', () => {
            const input = '前の文章 （話者の発言のみ） 後の文章';
            const result = cleanGPT4oResponse(input);
            expect(result).not.toContain('（話者の発言のみ）');
            expect(result).toContain('前の文章');
            expect(result).toContain('後の文章');
        });

        it('should preserve normal content that might contain similar words', () => {
            const input = '今日は出力について話しました。発言が重要です。';
            const result = cleanGPT4oResponse(input);
            expect(result).toContain('今日は出力について話しました');
            expect(result).toContain('発言が重要です');
        });
    });

    describe('buildTranscriptionPrompt language branching', () => {
        it('should return Japanese prompt for ja language', () => {
            const result = buildTranscriptionPrompt('ja');
            expect(result).toContain('以下の音声内容のみを文字に起こしてください');
            expect(result).toContain('<TRANSCRIPT>');
            expect(result).toContain('（話者の発言のみ）');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return empty string for non-ja languages', () => {
            const languages = ['en', 'zh', 'ko', 'auto', 'fr'];
            languages.forEach(lang => {
                expect(buildTranscriptionPrompt(lang)).toBe('');
            });
        });
    });

    describe('Locale detection for multilingual support', () => {
        it('should detect Japanese locale variants', () => {
            const jaLocales = ['ja', 'ja-JP', 'ja_JP', 'JA', 'JA-JP'];
            jaLocales.forEach(locale => {
                expect(detectPluginLanguage(locale)).toBe('ja');
            });
        });

        it('should detect Chinese locale variants', () => {
            const zhLocales = ['zh', 'zh-CN', 'zh-TW', 'zh_CN', 'ZH', 'zh-Hans', 'zh-Hant'];
            zhLocales.forEach(locale => {
                expect(detectPluginLanguage(locale)).toBe('zh');
            });
        });

        it('should detect Korean locale variants', () => {
            const koLocales = ['ko', 'ko-KR', 'ko_KR', 'KO', 'KO-KR'];
            koLocales.forEach(locale => {
                expect(detectPluginLanguage(locale)).toBe('ko');
            });
        });

        it('should default to English for other locales', () => {
            const otherLocales = ['en', 'en-US', 'en-GB', 'fr', 'de', 'es', 'it', 'ru', 'unknown', ''];
            otherLocales.forEach(locale => {
                expect(detectPluginLanguage(locale)).toBe('en');
            });
        });
    });

    describe('Error detection patterns', () => {
        function isPromptErrorDetected(text: string): boolean {
            return text.includes('この指示文は出力に含めないでください') || 
                   text.includes('話者の発言内容だけを正確に記録してください') ||
                   text === '（話者の発言のみ）' ||
                   text.trim() === '話者の発言のみ';
        }

        it('should detect prompt error patterns', () => {
            const errorPatterns = [
                'この指示文は出力に含めないでください',
                '話者の発言内容だけを正確に記録してください',
                '（話者の発言のみ）',
                '話者の発言のみ'
            ];

            errorPatterns.forEach(pattern => {
                expect(isPromptErrorDetected(pattern)).toBe(true);
            });
        });

        it('should not detect normal content as errors', () => {
            const normalContent = [
                'こんにちは、今日はいい天気ですね',
                'Meeting started at 2 PM',
                '会議の議事録を記録します',
                'The speaker mentioned important points'
            ];

            normalContent.forEach(content => {
                expect(isPromptErrorDetected(content)).toBe(false);
            });
        });
    });
});