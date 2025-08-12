/**
 * Integration tests for TranscriptionService multilingual dictionary correction
 * Validates that the service applies dictionary correction to all languages when enabled
 */

import { TranscriptionService } from '../../../../src/core/transcription/TranscriptionService';
import { SimpleCorrectionDictionary } from '../../../../src/interfaces';

// Mock the ObsidianHttpClient since we're not testing actual API calls
jest.mock('../../../../src/utils/ObsidianHttpClient', () => ({
    ObsidianHttpClient: {
        postFormData: jest.fn()
    }
}));

// Mock the logger
jest.mock('../../../../src/services', () => ({
    createServiceLogger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn()
    }))
}));

describe('TranscriptionService Multilingual Dictionary Correction Integration', () => {
    let service: TranscriptionService;
    
    const testDictionary: SimpleCorrectionDictionary = {
        definiteCorrections: [
            { from: ['AI'], to: 'artificial intelligence' },
            { from: ['GPT'], to: 'Generative Pre-trained Transformer' },
            { from: ['こんにちは'], to: 'こんにちは（修正済み）' },
            { from: ['你好'], to: '您好' },
            { from: ['안녕'], to: '안녕하세요' }
        ]
    };

    beforeEach(() => {
        service = new TranscriptionService('test-api-key', testDictionary);
        // Enable dictionary correction
        service.setTranscriptionCorrection(true);
    });

    // Helper to verify correction is applied via the service's corrector
    describe('Direct corrector access verification', () => {
        it('should provide access to corrector with multilingual capability', async () => {
            const corrector = service.getCorrector();
            
            // Test multiple languages
            const testCases = [
                { input: 'This AI uses GPT', expected: 'artificial intelligence' },
                { input: 'こんにちは、AIです', expected: 'こんにちは（修正済み）' },
                { input: '你好，这是AI', expected: '您好' },
                { input: '안녕, AI 시스템', expected: '안녕하세요' }
            ];
            
            for (const testCase of testCases) {
                const result = await corrector.correct(testCase.input);
                expect(result).toContain(testCase.expected);
            }
        });

        it('should respect the enableTranscriptionCorrection setting', async () => {
            const corrector = service.getCorrector();
            
            // Test with correction enabled
            service.setTranscriptionCorrection(true);
            let result = await corrector.correct('This AI system uses GPT');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            
            // Test with correction disabled  
            service.setTranscriptionCorrection(false);
            result = await corrector.correct('This AI system uses GPT');
            expect(result).toBe('This AI system uses GPT'); // Should remain unchanged
        });
    });

    describe('Dictionary update functionality', () => {
        it('should allow updating dictionary and apply new corrections to all languages', async () => {
            const newDictionary: SimpleCorrectionDictionary = {
                definiteCorrections: [
                    { from: ['ML'], to: 'Machine Learning' },
                    { from: ['さようなら'], to: 'さようなら（丁寧）' },
                    { from: ['再见'], to: '再見' },
                    { from: ['가다'], to: '가시다' }
                ]
            };
            
            // Update dictionary
            service.setCustomDictionary(newDictionary);
            const corrector = service.getCorrector();
            
            // Test that new corrections work for multiple languages
            const testCases = [
                { input: 'ML is powerful', expected: 'Machine Learning' },
                { input: 'さようなら、また明日', expected: 'さようなら（丁寧）' },
                { input: '再见朋友', expected: '再見' },
                { input: '가다 오다', expected: '가시다' }
            ];
            
            for (const testCase of testCases) {
                const result = await corrector.correct(testCase.input);
                expect(result).toContain(testCase.expected);
            }
            
            // Test that old corrections are replaced
            const oldResult = await corrector.correct('This AI uses GPT');
            expect(oldResult).toBe('This AI uses GPT'); // Old corrections should not apply
        });
    });

    describe('Settings update integration', () => {
        it('should respect corrector settings updates for all languages', async () => {
            const corrector = service.getCorrector();
            
            // Initial test - corrections should work
            let result = await corrector.correct('AI and GPT systems こんにちは');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('こんにちは（修正済み）');
            
            // Update settings to disable corrections
            service.updateCorrectorSettings({ enabled: false });
            
            // Corrections should no longer apply to any language
            result = await corrector.correct('AI and GPT systems こんにちは');
            expect(result).toBe('AI and GPT systems こんにちは');
            
            // Re-enable corrections
            service.updateCorrectorSettings({ enabled: true });
            
            // Corrections should work again for all languages
            result = await corrector.correct('AI and GPT systems こんにちは');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            expect(result).toContain('こんにちは（修正済み）');
        });
    });

    describe('API key update preservation', () => {
        it('should preserve dictionary settings when API key is updated', async () => {
            const corrector = service.getCorrector();
            
            // Test initial corrections work
            let result = await corrector.correct('AI and GPT systems');
            expect(result).toContain('artificial intelligence');
            
            // Update API key
            service.updateApiKey('new-test-api-key');
            
            // Dictionary corrections should still work
            const newCorrector = service.getCorrector();
            result = await newCorrector.correct('AI and GPT systems');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
        });
    });

    describe('Model update compatibility', () => {
        it('should maintain dictionary correction functionality across model changes', async () => {
            const corrector = service.getCorrector();
            
            // Test with initial model
            let result = await corrector.correct('AI uses GPT technology');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            
            // Change model
            service.setModel('gpt-4o-mini-transcribe');
            
            // Dictionary corrections should still work
            result = await corrector.correct('AI uses GPT technology');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
            
            // Change to other model
            service.setModel('gpt-4o-transcribe');
            
            // Dictionary corrections should still work
            result = await corrector.correct('AI uses GPT technology');
            expect(result).toContain('artificial intelligence');
            expect(result).toContain('Generative Pre-trained Transformer');
        });
    });
});