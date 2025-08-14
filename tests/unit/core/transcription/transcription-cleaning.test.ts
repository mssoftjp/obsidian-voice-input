/**
 * Comprehensive tests for transcription cleaning functionality
 * Tests the multilingual approach with language-specific patterns
 */

// Mock TranscriptionService to test its cleaning methods
class MockTranscriptionService {
    /**
     * Clean GPT-4o specific response artifacts with language-specific processing
     */
    cleanGPT4oResponse(text: string, language: string): string {
        // Normalize language for processing
        const normalizedLang = this.normalizeLanguage(language);
        
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

        // Remove TRANSCRIPT opening tag if still present (for cases where it's not properly extracted)
        text = text.replace(/<\/?TRANSCRIPT[^>]*>/g, '');

        // Apply language-specific cleaning
        text = this.applyLanguageSpecificCleaning(text, normalizedLang);

        // Apply generic cleaning (only colon-based patterns to prevent over-removal)
        text = this.applyGenericCleaning(text);
        
        // Clean up extra whitespace and empty lines
        text = text.trim();
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^\s*\n/gm, ''); // Remove lines with only whitespace
        text = text.trim();
        
        return text;
    }

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
     * Apply language-specific cleaning patterns
     */
    applyLanguageSpecificCleaning(text: string, language: string): string {
        switch (language) {
            case 'ja':
                return this.applyJapaneseCleaning(text);
            case 'en':
                return this.applyEnglishCleaning(text);
            case 'zh':
                return this.applyChineseCleaning(text);
            case 'ko':
                return this.applyKoreanCleaning(text);
            default:
                return text;
        }
    }

    /**
     * Apply Japanese-specific cleaning patterns
     */
    applyJapaneseCleaning(text: string): string {
        const patterns = [
            /^以下の音声内容.*?$/gm,
            /^この指示文.*?$/gm,
            /^話者の発言内容だけを正確に記録してください.*?$/gm,
            /^話者の発言.*?$/gm,
            /^出力形式.*?$/gm,
            /（話者の発言のみ）/g,
        ];

        for (const pattern of patterns) {
            text = text.replace(pattern, '');
        }
        return text;
    }

    /**
     * Apply English-specific cleaning patterns - using exact line matching for safety
     */
    applyEnglishCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = lines.filter(line => {
            const trimmedLine = line.trim();
            // Only remove lines that exactly match prompt instructions
            return !(
                trimmedLine === 'Please transcribe only the following audio content. Do not include this instruction in your output.' ||
                trimmedLine === 'Record only the speaker\'s statements accurately.' ||
                trimmedLine === 'Output format:' ||
                trimmedLine === '(Speaker content only)'
            );
        });

        // Also remove the phrase anywhere in text (not just full lines)
        let result = cleanedLines.join('\n');
        result = result.replace(/\(Speaker content only\)/g, '');
        
        return result;
    }

    /**
     * Apply Chinese-specific cleaning patterns - using exact line matching for safety
     */
    applyChineseCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = lines.filter(line => {
            const trimmedLine = line.trim();
            // Only remove lines that exactly match prompt instructions
            return !(
                trimmedLine === '请仅转录以下音频内容。不要包含此指令在输出中。' ||
                trimmedLine === '请准确记录说话者的发言内容。' ||
                trimmedLine === '输出格式:' ||
                trimmedLine === '（仅说话者内容）'
            );
        });

        // Also remove the phrase anywhere in text (not just full lines)
        let result = cleanedLines.join('\n');
        result = result.replace(/（仅说话者内容）/g, '');
        
        return result;
    }

    /**
     * Apply Korean-specific cleaning patterns - using exact line matching for safety
     */
    applyKoreanCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = lines.filter(line => {
            const trimmedLine = line.trim();
            // Only remove lines that exactly match prompt instructions
            return !(
                trimmedLine === '다음 음성 내용만 전사해주세요. 이 지시사항을 출력에 포함하지 마세요.' ||
                trimmedLine === '화자의 발언 내용만 정확히 기록해주세요.' ||
                trimmedLine === '출력 형식:' ||
                trimmedLine === '（화자 발언만）'
            );
        });

        // Also remove the phrase anywhere in text (not just full lines)
        let result = cleanedLines.join('\n');
        result = result.replace(/（화자 발언만）/g, '');
        
        return result;
    }

    /**
     * Apply generic cleaning patterns (conservative approach) - using exact line matching for safety
     */
    applyGenericCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = lines.filter(line => {
            const trimmedLine = line.trim();
            // Only remove lines that exactly match generic format instructions
            return !(
                trimmedLine === 'Output format:' ||
                trimmedLine === 'Format:'
            );
        });

        return cleanedLines.join('\n');
    }

    /**
     * Detect prompt error patterns by language
     */
    isPromptErrorDetected(text: string, language: string): boolean {
        const normalizedLang = this.normalizeLanguage(language);
        
        switch (normalizedLang) {
            case 'ja':
                return text.includes('この指示文は出力に含めないでください') || 
                       text.includes('話者の発言内容だけを正確に記録してください') ||
                       text === '（話者の発言のみ）' ||
                       text.trim() === '話者の発言のみ';
            case 'en':
                return text.includes('Please transcribe only the speaker') ||
                       text.includes('Do not include this instruction') ||
                       text.trim() === '(Speaker content only)';
            case 'zh':
                return text.includes('请仅转录说话者') ||
                       text.includes('不要包含此指令') ||
                       text.trim() === '（仅说话者内容）';
            case 'ko':
                return text.includes('화자의 발언만 전사해주세요') ||
                       text.includes('이 지시사항을 포함하지 마세요') ||
                       text.trim() === '（화자 발언만）';
            default:
                // For auto and other languages, use Japanese patterns as fallback
                return text.includes('この指示文は出力に含めないでください') || 
                       text.includes('話者の発言内容だけを正確に記録してください') ||
                       text === '（話者の発言のみ）' ||
                       text.trim() === '話者の発言のみ';
        }
    }

    /**
     * Build prompt for GPT-4o transcription
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

describe('Multilingual Transcription Cleaning', () => {
    let service: MockTranscriptionService;

    beforeEach(() => {
        service = new MockTranscriptionService();
    });

    describe('TRANSCRIPT tag extraction', () => {
        it('should extract content from complete TRANSCRIPT tags', () => {
            const input = `Some prefix text
<TRANSCRIPT>
実際の発言内容
</TRANSCRIPT>
Some suffix text`;
            const result = service.cleanGPT4oResponse(input, 'ja');
            expect(result).toContain('実際の発言内容');
            expect(result).not.toContain('<TRANSCRIPT>');
            expect(result).not.toContain('</TRANSCRIPT>');
        });

        it('should handle incomplete TRANSCRIPT tags (missing closing tag)', () => {
            const input = `Some prefix text
<TRANSCRIPT>
実際の発言内容
Additional content`;
            const result = service.cleanGPT4oResponse(input, 'ja');
            expect(result).toContain('実際の発言内容');
            expect(result).toContain('Additional content');
            expect(result).not.toContain('<TRANSCRIPT>');
        });

        it('should handle malformed TRANSCRIPT tags', () => {
            const input = `<TRANSCRIPT class="test">
Content with attributes
</TRANSCRIPT>`;
            const result = service.cleanGPT4oResponse(input, 'en');
            expect(result).toContain('Content with attributes');
            expect(result).not.toContain('<TRANSCRIPT');
            expect(result).not.toContain('</TRANSCRIPT>');
        });
    });

    describe('Language-specific cleaning', () => {
        describe('Japanese cleaning', () => {
            it('should remove Japanese meta instructions', () => {
                const patterns = [
                    '以下の音声内容のみを文字に起こしてください',
                    'この指示文は出力に含めないでください',
                    '話者の発言内容だけを正確に記録してください',
                    '出力形式:'
                ];

                patterns.forEach(pattern => {
                    const input = `${pattern}\n実際の発言\nその他の内容`;
                    const result = service.cleanGPT4oResponse(input, 'ja');
                    expect(result).not.toContain(pattern);
                    expect(result).toContain('実際の発言');
                    expect(result).toContain('その他の内容');
                });
            });

            it('should remove Japanese meta phrases anywhere in text', () => {
                const input = '前の文章 （話者の発言のみ） 後の文章';
                const result = service.cleanGPT4oResponse(input, 'ja');
                expect(result).not.toContain('（話者の発言のみ）');
                expect(result).toContain('前の文章');
                expect(result).toContain('後の文章');
            });
        });

        describe('English cleaning', () => {
            it('should remove English meta instructions', () => {
                const exactPatterns = [
                    'Please transcribe only the following audio content. Do not include this instruction in your output.',
                    'Record only the speaker\'s statements accurately.',
                    'Output format:'
                ];

                exactPatterns.forEach(pattern => {
                    const input = `${pattern}\nActual speech\nOther content`;
                    const result = service.cleanGPT4oResponse(input, 'en');
                    expect(result).not.toContain(pattern);
                    expect(result).toContain('Actual speech');
                    expect(result).toContain('Other content');
                });
            });

            it('should NOT remove similar but different phrases to avoid over-removal', () => {
                const normalContent = [
                    'Please transcribe this document',  // Different from exact prompt
                    'Do not include extras',           // Different from exact prompt  
                    'Record everything accurately',     // Different from exact prompt
                    'Output format is important',      // Different from exact prompt
                    'Format the data properly'         // Different from exact prompt
                ];

                normalContent.forEach(content => {
                    const input = `${content}\nActual speech\nOther content`;
                    const result = service.cleanGPT4oResponse(input, 'en');
                    expect(result).toContain(content);
                    expect(result).toContain('Actual speech');
                    expect(result).toContain('Other content');
                });
            });

            it('should remove English meta phrases anywhere in text', () => {
                const input = 'Before text (Speaker content only) After text';
                const result = service.cleanGPT4oResponse(input, 'en');
                expect(result).not.toContain('(Speaker content only)');
                expect(result).toContain('Before text');
                expect(result).toContain('After text');
            });
        });

        describe('Chinese cleaning', () => {
            it('should remove Chinese meta instructions', () => {
                const exactPatterns = [
                    '请仅转录以下音频内容。不要包含此指令在输出中。',
                    '请准确记录说话者的发言内容。',
                    '输出格式:'
                ];

                exactPatterns.forEach(pattern => {
                    const input = `${pattern}\n实际语音\n其他内容`;
                    const result = service.cleanGPT4oResponse(input, 'zh');
                    expect(result).not.toContain(pattern);
                    expect(result).toContain('实际语音');
                    expect(result).toContain('其他内容');
                });
            });

            it('should NOT remove similar but different phrases to avoid over-removal', () => {
                const normalContent = [
                    '请转录这个文档',              // Different from exact prompt
                    '不要包含额外内容',            // Different from exact prompt
                    '请准确记录所有内容',          // Different from exact prompt
                    '输出格式很重要',              // Different from exact prompt
                    '格式化数据正确'               // Different from exact prompt
                ];

                normalContent.forEach(content => {
                    const input = `${content}\n实际语音\n其他内容`;
                    const result = service.cleanGPT4oResponse(input, 'zh');
                    expect(result).toContain(content);
                    expect(result).toContain('实际语音');
                    expect(result).toContain('其他内容');
                });
            });

            it('should remove Chinese meta phrases anywhere in text', () => {
                const input = '前面的文字 （仅说话者内容） 后面的文字';
                const result = service.cleanGPT4oResponse(input, 'zh');
                expect(result).not.toContain('（仅说话者内容）');
                expect(result).toContain('前面的文字');
                expect(result).toContain('后面的文字');
            });
        });

        describe('Korean cleaning', () => {
            it('should remove Korean meta instructions', () => {
                const exactPatterns = [
                    '다음 음성 내용만 전사해주세요. 이 지시사항을 출력에 포함하지 마세요.',
                    '화자의 발언 내용만 정확히 기록해주세요.',
                    '출력 형식:'
                ];

                exactPatterns.forEach(pattern => {
                    const input = `${pattern}\n실제 음성\n기타 내용`;
                    const result = service.cleanGPT4oResponse(input, 'ko');
                    expect(result).not.toContain(pattern);
                    expect(result).toContain('실제 음성');
                    expect(result).toContain('기타 내용');
                });
            });

            it('should NOT remove similar but different phrases to avoid over-removal', () => {
                const normalContent = [
                    '다음 음성을 들어보세요',      // Different from exact prompt
                    '이 지시사항이 중요합니다',    // Different from exact prompt
                    '화자의 발언을 기록합니다',    // Different from exact prompt
                    '출력 형식이 중요합니다',      // Different from exact prompt
                    '형식을 올바르게 설정'        // Different from exact prompt
                ];

                normalContent.forEach(content => {
                    const input = `${content}\n실제 음성\n기타 내용`;
                    const result = service.cleanGPT4oResponse(input, 'ko');
                    expect(result).toContain(content);
                    expect(result).toContain('실제 음성');
                    expect(result).toContain('기타 내용');
                });
            });

            it('should remove Korean meta phrases anywhere in text', () => {
                const input = '앞의 문장 （화자 발언만） 뒤의 문장';
                const result = service.cleanGPT4oResponse(input, 'ko');
                expect(result).not.toContain('（화자 발언만）');
                expect(result).toContain('앞의 문장');
                expect(result).toContain('뒤의 문장');
            });
        });
    });

    describe('Generic cleaning (conservative approach)', () => {
        it('should only remove exact format instruction lines', () => {
            const input = `Output format:
Normal sentence about output
Format:
Another normal sentence`;
            
            const result = service.cleanGPT4oResponse(input, 'en');
            expect(result).not.toContain('Output format:');
            expect(result).not.toContain('Format:');
            expect(result).toContain('Normal sentence about output');
            expect(result).toContain('Another normal sentence');
        });

        it('should NOT remove format-related content with additional text', () => {
            const input = `Output format: JSON response
Format: Speaker content only
Output was successful
Format looks good
This is normal content`;
            
            const result = service.cleanGPT4oResponse(input, 'fr'); // Non-supported language
            expect(result).toContain('Output format: JSON response');
            expect(result).toContain('Format: Speaker content only');
            expect(result).toContain('Output was successful');
            expect(result).toContain('Format looks good');
            expect(result).toContain('This is normal content');
        });
    });

    describe('Prompt error detection by language', () => {
        describe('Japanese error detection', () => {
            it('should detect Japanese prompt error patterns', () => {
                const errorPatterns = [
                    'この指示文は出力に含めないでください',
                    '話者の発言内容だけを正確に記録してください',
                    '（話者の発言のみ）',
                    '話者の発言のみ'
                ];

                errorPatterns.forEach(pattern => {
                    expect(service.isPromptErrorDetected(pattern, 'ja')).toBe(true);
                });
            });
        });

        describe('English error detection', () => {
            it('should detect English prompt error patterns', () => {
                const errorPatterns = [
                    'Please transcribe only the speaker',
                    'Do not include this instruction',
                    '(Speaker content only)'
                ];

                errorPatterns.forEach(pattern => {
                    expect(service.isPromptErrorDetected(pattern, 'en')).toBe(true);
                });
            });
        });

        describe('Chinese error detection', () => {
            it('should detect Chinese prompt error patterns', () => {
                const errorPatterns = [
                    '请仅转录说话者',
                    '不要包含此指令',
                    '（仅说话者内容）'
                ];

                errorPatterns.forEach(pattern => {
                    expect(service.isPromptErrorDetected(pattern, 'zh')).toBe(true);
                });
            });
        });

        describe('Korean error detection', () => {
            it('should detect Korean prompt error patterns', () => {
                const errorPatterns = [
                    '화자의 발언만 전사해주세요',
                    '이 지시사항을 포함하지 마세요',
                    '（화자 발언만）'
                ];

                errorPatterns.forEach(pattern => {
                    expect(service.isPromptErrorDetected(pattern, 'ko')).toBe(true);
                });
            });
        });

        it('should NOT detect normal content as errors', () => {
            const normalContent = [
                'こんにちは、今日はいい天気ですね',
                'Hello, how are you today?',
                '你好，今天天气不错',
                '안녕하세요, 오늘 날씨가 좋네요'
            ];

            normalContent.forEach(content => {
                expect(service.isPromptErrorDetected(content, 'ja')).toBe(false);
                expect(service.isPromptErrorDetected(content, 'en')).toBe(false);
                expect(service.isPromptErrorDetected(content, 'zh')).toBe(false);
                expect(service.isPromptErrorDetected(content, 'ko')).toBe(false);
            });
        });
    });

    describe('buildTranscriptionPrompt language branching', () => {
        it('should return Japanese prompt for ja language', () => {
            const result = service.buildTranscriptionPrompt('ja');
            expect(result).toContain('以下の音声内容のみを文字に起こしてください');
            expect(result).toContain('<TRANSCRIPT>');
            expect(result).toContain('（話者の発言のみ）');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return English prompt for en language', () => {
            const result = service.buildTranscriptionPrompt('en');
            expect(result).toContain('Please transcribe only the following audio content');
            expect(result).toContain('<TRANSCRIPT>');
            expect(result).toContain('(Speaker content only)');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return Chinese prompt for zh language', () => {
            const result = service.buildTranscriptionPrompt('zh');
            expect(result).toContain('请仅转录以下音频内容');
            expect(result).toContain('<TRANSCRIPT>');
            expect(result).toContain('（仅说话者内容）');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return Korean prompt for ko language', () => {
            const result = service.buildTranscriptionPrompt('ko');
            expect(result).toContain('다음 음성 내용만 전사해주세요');
            expect(result).toContain('<TRANSCRIPT>');
            expect(result).toContain('（화자 발언만）');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return empty string for auto language', () => {
            expect(service.buildTranscriptionPrompt('auto')).toBe('');
        });

        it('should return empty string for unsupported languages', () => {
            const languages = ['fr', 'de', 'es', 'unknown'];
            languages.forEach(lang => {
                expect(service.buildTranscriptionPrompt(lang)).toBe('');
            });
        });
    });

    describe('Language normalization', () => {
        it('should normalize language codes correctly', () => {
            expect(service.normalizeLanguage('ja')).toBe('ja');
            expect(service.normalizeLanguage('ja-JP')).toBe('ja');
            expect(service.normalizeLanguage('JA')).toBe('ja');
            
            expect(service.normalizeLanguage('en')).toBe('en');
            expect(service.normalizeLanguage('en-US')).toBe('en');
            expect(service.normalizeLanguage('EN')).toBe('en');
            
            expect(service.normalizeLanguage('zh')).toBe('zh');
            expect(service.normalizeLanguage('zh-CN')).toBe('zh');
            expect(service.normalizeLanguage('ZH')).toBe('zh');
            
            expect(service.normalizeLanguage('ko')).toBe('ko');
            expect(service.normalizeLanguage('ko-KR')).toBe('ko');
            expect(service.normalizeLanguage('KO')).toBe('ko');
            
            expect(service.normalizeLanguage('auto')).toBe('auto');
            expect(service.normalizeLanguage('fr')).toBe('fr');
        });
    });

    describe('Whitespace and formatting cleanup', () => {
        it('should clean up extra whitespace and empty lines', () => {
            const input = `  \n\n\n実際の内容\n\n\n\n別の内容\n\n  `;
            const result = service.cleanGPT4oResponse(input, 'ja');
            // After trim, replace 3+ newlines with 2, then remove empty lines, the result should be without double newlines
            expect(result).toBe('実際の内容\n別の内容');
        });

        it('should preserve single line breaks between content', () => {
            const input = `Line 1\nLine 2\nLine 3`;
            const result = service.cleanGPT4oResponse(input, 'en');
            expect(result).toBe('Line 1\nLine 2\nLine 3');
        });

        it('should convert triple+ line breaks to double then remove empty lines', () => {
            const input = `Line 1\n\n\n\n\nLine 2`;
            const result = service.cleanGPT4oResponse(input, 'en');
            // The regex /^\s*\n/gm removes lines that contain only whitespace, which includes the double newlines
            expect(result).toBe('Line 1\nLine 2');
        });
    });

    describe('Integration-style tests', () => {
        it('should handle complex multilingual transcription response', () => {
            const input = `<TRANSCRIPT>
以下の音声内容のみを文字に起こしてください
こんにちは、今日は会議です
出力形式: JSON
（話者の発言のみ）
</TRANSCRIPT>`;
            
            const result = service.cleanGPT4oResponse(input, 'ja');
            expect(result).toBe('こんにちは、今日は会議です');
        });

        it('should preserve content when no cleaning is needed', () => {
            const input = 'Hello everyone, welcome to the meeting';
            const result = service.cleanGPT4oResponse(input, 'en');
            expect(result).toBe('Hello everyone, welcome to the meeting');
        });

        it('should handle mixed language content appropriately', () => {
            // This test now expects only exact matches to be removed
            const input = `Please transcribe the following
Hello world
Format: Clean output`;
            
            const result = service.cleanGPT4oResponse(input, 'en');
            // Since none of these lines exactly match our prompt patterns, they should all remain
            expect(result).toContain('Please transcribe the following');
            expect(result).toContain('Hello world');
            expect(result).toContain('Format: Clean output');
        });
    });
});