/**
 * Tests for multilingual dictionary correction functionality
 * Validates that dictionary correction applies to all languages when enabled
 */

import { DictionaryCorrector } from '../../../../src/core/transcription/DictionaryCorrector';
import { SimpleCorrectionDictionary } from '../../../../src/interfaces';

describe('Multilingual Dictionary Correction', () => {
    let corrector: DictionaryCorrector;
    
    // Sample dictionary with common corrections
    const testDictionary: SimpleCorrectionDictionary = {
        definiteCorrections: [
            { from: ['AI'], to: 'artificial intelligence' },
            { from: ['GPT'], to: 'Generative Pre-trained Transformer' },
            { from: ['API'], to: 'Application Programming Interface' },
            { from: ['UI'], to: 'User Interface' },
            { from: ['あなた'], to: 'あなた様' }, // Japanese correction
            { from: ['hello'], to: 'Hello' }, // English correction
            { from: ['你好'], to: '您好' }, // Chinese correction (informal to formal)
            { from: ['안녕'], to: '안녕하세요' }, // Korean correction (informal to formal)
        ]
    };

    beforeEach(() => {
        corrector = new DictionaryCorrector({
            enabled: true,
            correctionDictionary: testDictionary
        });
    });

    describe('Dictionary correction applies to all languages', () => {
        it('should apply corrections to English text', async () => {
            const input = 'The AI uses GPT technology for API calls with a modern UI.';
            const result = await corrector.correct(input);
            
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('Application Programming Interface');
            expect(result).toContain('User Interface');
            expect(result).not.toContain('AI ');
            expect(result).not.toContain('GPT ');
            expect(result).not.toContain('API ');
            expect(result).not.toContain('UI.');
        });

        it('should apply corrections to Japanese text', async () => {
            const input = 'あなたは AI を使って GPT で API を呼び出します。';
            const result = await corrector.correct(input);
            
            expect(result).toContain('あなた様');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('Application Programming Interface');
            expect(result).not.toContain('あなたは');
        });

        it('should apply corrections to Chinese text', async () => {
            const input = '你好，AI 使用 GPT 技术通过 API 调用。';
            const result = await corrector.correct(input);
            
            expect(result).toContain('您好');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('Application Programming Interface');
            expect(result).not.toContain('你好');
        });

        it('should apply corrections to Korean text', async () => {
            const input = '안녕, AI가 GPT 기술로 API를 호출합니다.';
            const result = await corrector.correct(input);
            
            expect(result).toContain('안녕하세요');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('Application Programming Interface');
            expect(result).not.toContain('안녕,');
        });

        it('should apply corrections to mixed language text', async () => {
            const input = 'Hello, あなた! The AI system uses GPT. 你好 API!';
            const result = await corrector.correct(input);
            
            expect(result).toContain('Hello');
            expect(result).toContain('あなた様');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('您好');
            expect(result).toContain('Application Programming Interface');
        });
    });

    describe('Dictionary correction can be disabled', () => {
        it('should not apply corrections when disabled', async () => {
            const disabledCorrector = new DictionaryCorrector({
                enabled: false,
                correctionDictionary: testDictionary
            });

            const input = 'The AI uses GPT technology for API calls with a modern UI.';
            const result = await disabledCorrector.correct(input);
            
            // Should return original text unchanged
            expect(result).toBe(input);
            expect(result).toContain('AI');
            expect(result).toContain('GPT');
            expect(result).toContain('API');
            expect(result).toContain('UI');
        });
    });

    describe('Empty or missing dictionary handling', () => {
        it('should handle empty dictionary gracefully', async () => {
            const emptyCorrector = new DictionaryCorrector({
                enabled: true,
                correctionDictionary: { definiteCorrections: [] }
            });

            const inputs = [
                'English text with AI and GPT',
                'あなたは日本語です',
                '你好中文',
                '안녕하세요 한국어'
            ];

            for (const input of inputs) {
                const result = await emptyCorrector.correct(input);
                expect(result).toBe(input); // Should return unchanged
            }
        });

        it('should handle missing dictionary gracefully', async () => {
            const noDictCorrector = new DictionaryCorrector({
                enabled: true
                // No correctionDictionary provided
            });

            const inputs = [
                'English text with AI and GPT',
                'あなたは日本語です',
                '你好中文',
                '안녕하세요 한국어'
            ];

            for (const input of inputs) {
                const result = await noDictCorrector.correct(input);
                expect(result).toBe(input); // Should return unchanged
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle short text correctly', async () => {
            const shortTexts = ['AI', 'GPT', 'API', 'UI'];
            
            for (const text of shortTexts) {
                const result = await corrector.correct(text);
                expect(result).not.toBe(text); // Should be corrected
                expect(result.length).toBeGreaterThan(text.length);
            }
        });

        it('should handle empty or very short text', async () => {
            const emptyTexts = ['', ' ', 'a'];
            
            for (const text of emptyTexts) {
                const result = await corrector.correct(text);
                // Should return as-is for very short text based on implementation
                expect(result).toBe(text);
            }
        });

        it('should handle text without any corrections needed', async () => {
            const cleanTexts = [
                'This is clean English text.',
                'これは綺麗な日本語です。',
                '这是干净的中文文本。',
                '이것은 깨끗한 한국어 텍스트입니다.'
            ];
            
            for (const text of cleanTexts) {
                const result = await corrector.correct(text);
                expect(result).toBe(text); // Should return unchanged
            }
        });
    });

    describe('Case sensitivity and pattern matching', () => {
        it('should match corrections case-sensitively', async () => {
            const input = 'The ai and AI are different, also gpt vs GPT.';
            const result = await corrector.correct(input);
            
            // Only 'AI' and 'GPT' (exact case matches) should be corrected
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('ai and'); // lowercase 'ai' should remain
            expect(result).toContain('gpt vs'); // lowercase 'gpt' should remain
        });

        it('should handle multiple occurrences of the same pattern', async () => {
            const input = 'AI helps with AI development. GPT-3 and GPT-4 are AI models.';
            const result = await corrector.correct(input);
            
            // All instances of 'AI' and 'GPT' should be corrected
            expect(result).not.toContain('AI ');
            expect(result).not.toContain('GPT-');
            const aiCount = (result.match(/artificial intelligence/g) || []).length;
            const gptCount = (result.match(/Generative Pre-trained Transformer/g) || []).length;
            expect(aiCount).toBeGreaterThanOrEqual(2);
            expect(gptCount).toBeGreaterThanOrEqual(2);
        });
    });
});