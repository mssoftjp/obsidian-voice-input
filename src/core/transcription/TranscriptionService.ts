import { DictionaryCorrector } from './DictionaryCorrector';
import { TranscriptionResult, ITranscriptionProvider, SimpleCorrectionDictionary } from '../../interfaces';
import { TranscriptionError, TranscriptionErrorType } from '../../errors';
import { SecurityUtils } from '../../security';
import { API_CONSTANTS, DEFAULT_TRANSCRIPTION_SETTINGS, TRANSCRIPTION_MODEL_COSTS } from '../../config';
import { ObsidianHttpClient } from '../../utils/ObsidianHttpClient';
import { createServiceLogger } from '../../services';
import { Logger } from '../../utils';

export class TranscriptionService implements ITranscriptionProvider {
    private apiKey: string;
    private corrector: DictionaryCorrector;
    private logger: Logger;
    // 注: gpt-4o-mini-transcribe と gpt-4o-transcribe の両方が日本語音声認識で高精度
    // コスト重視なら mini、わずかな精度向上が必要なら通常版を選択
    private model: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' = DEFAULT_TRANSCRIPTION_SETTINGS.model;
    private enableTranscriptionCorrection: boolean = DEFAULT_TRANSCRIPTION_SETTINGS.enableTranscriptionCorrection;
    private language: string = 'ja';

    constructor(apiKey: string, dictionary?: SimpleCorrectionDictionary) {
        this.apiKey = apiKey;
        this.logger = createServiceLogger('TranscriptionService');
        this.corrector = new DictionaryCorrector({
            correctionDictionary: dictionary
        });
    }

    async transcribe(audioBlob: Blob, language: string = 'ja'): Promise<TranscriptionResult> {
        return this.transcribeAudio(audioBlob, language);
    }

    async transcribeAudio(audioBlob: Blob, language: string = 'ja'): Promise<TranscriptionResult> {
        const startTime = Date.now();
        const perfStartTime = performance.now();
        
        this.logger.info('Starting transcription', {
            audioBlobSize: audioBlob.size,
            audioType: audioBlob.type,
            language,
            model: this.model,
            enableTranscriptionCorrection: this.enableTranscriptionCorrection
        });
        
        try {
            // Convert audio blob to proper format for API
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('model', this.model);
            formData.append('response_format', 'json');
            formData.append('temperature', String(API_CONSTANTS.PARAMETERS.TRANSCRIPTION_TEMPERATURE)); // Deterministic output
            
            // Language setting
            if (language !== 'auto') {
                formData.append('language', language);
            }

            // Build prompt for transcription
            const prompt = this.buildTranscriptionPrompt();
            if (prompt) {
                formData.append('prompt', prompt);
            }

            
            // IMPORTANT: OpenAI Audio API implementation
            // この部分を変更する場合は、必ずOpenAI APIの仕様を確認すること
            // 参照: https://platform.openai.com/docs/api-reference/audio/createTranscription
            // 
            // 要件:
            // - multipart/form-data形式
            // - fileフィールドは音声ファイル（Blob）
            // - modelフィールドは必須
            // - boundary設定が必要
            
            // Send multipart request via centralized HTTP client
            const { status, json: responseData } = await ObsidianHttpClient.postFormData(
                API_CONSTANTS.ENDPOINTS.TRANSCRIPTION,
                formData,
                { 'Authorization': `Bearer ${this.apiKey}` }
            );

            if (status >= 400) {
                const errorData = responseData as Record<string, unknown> | undefined;
                let errorMessage = `HTTP ${status}`;
                
                if (errorData && typeof errorData === 'object' && 'error' in errorData 
                    && typeof errorData.error === 'object' && errorData.error 
                    && 'message' in errorData.error) {
                    const errorObj = errorData.error as Record<string, unknown>;
                    if (typeof errorObj.message === 'string') {
                        errorMessage = errorObj.message;
                    }
                }
                
                // Determine error type based on status and message
                let errorType = TranscriptionErrorType.TRANSCRIPTION_FAILED;
                if (status === 401) {
                    errorType = TranscriptionErrorType.INVALID_API_KEY;
                } else if (status === 429) {
                    errorType = TranscriptionErrorType.API_QUOTA_EXCEEDED;
                } else if (status >= 500) {
                    errorType = TranscriptionErrorType.NETWORK_ERROR;
                }
                
                throw new TranscriptionError(errorType, errorMessage);
            }
            
            
            // Extract text from response
            let originalText = '';
            if (responseData.text) {
                originalText = responseData.text;
            } else if (typeof responseData === 'string') {
                originalText = responseData;
            }

            // Clean up GPT-4o specific artifacts
            originalText = this.cleanGPT4oResponse(originalText, language);
            
            
            // プロンプトエラーの検出（音声が無音の場合にプロンプトが返される問題）
            // 言語別のプロンプトパターン検出
            if (this.isPromptErrorDetected(originalText, language)) {
                // 音声がない場合は空文字を返す
                originalText = '';
            }
            
            // 空文字の場合は後処理をスキップして早期リターン
            if (!originalText || originalText.trim() === '') {
                const duration = Date.now() - startTime;
                const elapsedTime = performance.now() - perfStartTime;
                this.logger.info('Transcription completed (empty result)', { 
                    elapsedTime: `${elapsedTime.toFixed(2)}ms`,
                    duration 
                });
                return {
                    text: '',
                    originalText: '',
                    duration,
                    model: this.model,
                    language: responseData.language || language
                };
            }
            
            // Apply corrections if enabled (only for Japanese)
            const correctedText = this.enableTranscriptionCorrection && language === 'ja'
                ? await this.corrector.correct(originalText)
                : originalText;
            
            const duration = Date.now() - startTime;
            const elapsedTime = performance.now() - perfStartTime;
            
            this.logger.info('Transcription completed', {
                originalLength: originalText.length,
                correctedLength: correctedText.length,
                duration,
                elapsedTime: `${elapsedTime.toFixed(2)}ms`,
                wasCorrected: correctedText !== originalText,
                model: this.model,
                inputSize: audioBlob.size,
                outputLength: correctedText.length
            });
            
            return {
                text: correctedText,
                originalText,
                duration,
                model: this.model,
                language: responseData.language || language
            };
        } catch (error) {
            this.logger.error('Transcription error', error);
            
            if (error instanceof TranscriptionError) {
                throw error;
            }
            
            throw TranscriptionError.fromError(error, TranscriptionErrorType.TRANSCRIPTION_FAILED);
        }
    }

    /**
     * Build prompt for GPT-4o transcription
     */
    private buildTranscriptionPrompt(): string {
        return `以下の音声内容のみを文字に起こしてください。この指示文は出力に含めないでください。
話者の発言内容だけを正確に記録してください。

出力形式:
<TRANSCRIPT>
（話者の発言のみ）
</TRANSCRIPT>`;
    }

    /**
     * Clean GPT-4o specific response artifacts with language awareness
     */
    private cleanGPT4oResponse(text: string, language: string = 'ja'): string {
        // Language-agnostic cleaning: Extract content from TRANSCRIPT tags
        let transcriptMatch = text.match(/<TRANSCRIPT>\s*([\s\S]*?)\s*<\/TRANSCRIPT>/);
        if (transcriptMatch) {
            text = transcriptMatch[1];
        } else {
            // Handle incomplete TRANSCRIPT tags (missing closing tag)
            const openingMatch = text.match(/<TRANSCRIPT>\s*([\s\S]*)/);
            if (openingMatch) {
                text = openingMatch[1];
            }
        }

        // Remove TRANSCRIPT opening tag if still present (for cases where it's not properly extracted)
        text = text.replace(/<\/?TRANSCRIPT[^>]*>/g, '');

        // Apply language-specific cleaning
        text = this.applyLanguageSpecificCleaning(text, language);
        
        // Language-agnostic final cleanup: extra whitespace and empty lines
        text = text.trim();
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^\s*\n/gm, ''); // Remove lines with only whitespace
        text = text.trim();
        
        return text;
    }

    /**
     * Apply language-specific cleaning patterns
     */
    private applyLanguageSpecificCleaning(text: string, language: string): string {
        switch (language) {
            case 'ja':
                return this.cleanJapaneseMetaText(text);
            case 'en':
                return this.cleanEnglishMetaText(text);
            case 'zh':
            case 'zh-CN':
            case 'zh-TW':
                return this.cleanChineseMetaText(text);
            case 'ko':
                return this.cleanKoreanMetaText(text);
            default:
                // For unknown languages, only apply basic meta text removal
                return this.cleanGenericMetaText(text);
        }
    }

    /**
     * Clean Japanese-specific meta text patterns
     */
    private cleanJapaneseMetaText(text: string): string {
        const japaneseMetaPatterns = [
            /^以下の音声内容.*?$/gm,
            /^この指示文.*?$/gm,
            /^話者の発言内容だけを正確に記録してください.*?$/gm,
            /^話者の発言.*?$/gm,
            /^出力形式.*?$/gm,
            /（話者の発言のみ）/g,  // Remove this specific phrase anywhere in the text
        ];

        // Apply all Japanese cleaning patterns
        for (const pattern of japaneseMetaPatterns) {
            text = text.replace(pattern, '');
        }
        
        return text;
    }

    /**
     * Clean English-specific meta text patterns
     */
    private cleanEnglishMetaText(text: string): string {
        const englishMetaPatterns = [
            /^Transcribe the following audio content.*?$/gm,
            /^Please transcribe only the speaker's words.*?$/gm,
            /^Output format.*?$/gm,
            /\(speaker's words only\)/gi,
        ];

        for (const pattern of englishMetaPatterns) {
            text = text.replace(pattern, '');
        }
        
        return text;
    }

    /**
     * Clean Chinese-specific meta text patterns
     */
    private cleanChineseMetaText(text: string): string {
        const chineseMetaPatterns = [
            /^请转录以下音频内容.*?$/gm,
            /^请只记录说话者的发言内容.*?$/gm,
            /^输出格式.*?$/gm,
            /（仅说话者发言）/g,
        ];

        for (const pattern of chineseMetaPatterns) {
            text = text.replace(pattern, '');
        }
        
        return text;
    }

    /**
     * Clean Korean-specific meta text patterns
     */
    private cleanKoreanMetaText(text: string): string {
        const koreanMetaPatterns = [
            /^다음 음성 내용을 전사해주세요.*?$/gm,
            /^화자의 발언 내용만 정확히 기록해주세요.*?$/gm,
            /^출력 형식.*?$/gm,
            /\(화자 발언만\)/g,
        ];

        for (const pattern of koreanMetaPatterns) {
            text = text.replace(pattern, '');
        }
        
        return text;
    }

    /**
     * Clean generic meta text patterns for unknown languages
     */
    private cleanGenericMetaText(text: string): string {
        // Only remove very basic instruction patterns that are likely meta-text
        const genericMetaPatterns = [
            /^Output format.*?$/gm,
            /^Format.*?$/gm,
        ];

        for (const pattern of genericMetaPatterns) {
            text = text.replace(pattern, '');
        }
        
        return text;
    }

    /**
     * Detect if the response contains prompt error patterns (when audio is silent)
     */
    private isPromptErrorDetected(text: string, language: string): boolean {
        switch (language) {
            case 'ja':
                return text.includes('この指示文は出力に含めないでください') || 
                       text.includes('話者の発言内容だけを正確に記録してください') ||
                       text === '（話者の発言のみ）' ||
                       text.trim() === '話者の発言のみ';
            case 'en':
                return text.includes('Do not include this instruction in the output') ||
                       text.includes('Please transcribe only the speaker\'s words') ||
                       text === '(speaker\'s words only)' ||
                       text.trim().toLowerCase() === 'speaker\'s words only';
            case 'zh':
            case 'zh-CN':
            case 'zh-TW':
                return text.includes('请不要在输出中包含此指示') ||
                       text.includes('请只记录说话者的发言内容') ||
                       text === '（仅说话者发言）' ||
                       text.trim() === '仅说话者发言';
            case 'ko':
                return text.includes('이 지시사항을 출력에 포함하지 마세요') ||
                       text.includes('화자의 발언 내용만 정확히 기록해주세요') ||
                       text === '(화자 발언만)' ||
                       text.trim() === '화자 발언만';
            default:
                // For unknown languages, use a conservative approach
                return false;
        }
    }

    /**
     * Estimate transcription cost
     */
    estimateCost(audioLengthSeconds: number): number {
        const audioLengthMinutes = audioLengthSeconds / 60;
        
        // Get cost per minute from configuration
        const costPerMinute = TRANSCRIPTION_MODEL_COSTS[this.model];
        
        return audioLengthMinutes * costPerMinute;
    }

    /**
     * Convert audio blob to WAV format if needed
     */
    private async convertToWav(audioBlob: Blob): Promise<Blob> {
        // If already WAV, return as-is
        if (audioBlob.type === 'audio/wav') {
            return audioBlob;
        }

        // For now, we'll use webm directly as GPT-4o supports it
        // In the future, we might want to implement proper conversion
        return audioBlob;
    }

    /**
     * Update settings
     */
    updateCorrectorSettings(settings: { enabled: boolean }) {
        this.enableTranscriptionCorrection = settings.enabled;
        this.corrector.updateSettings({
            enabled: settings.enabled
        });
    }
    
    /**
     * Set transcription correction enabled/disabled
     */
    setTranscriptionCorrection(enabled: boolean) {
        this.enableTranscriptionCorrection = enabled;
    }

    /**
     * Update API key
     */
    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
        // API key is no longer needed for the simplified corrector
        // Preserve existing dictionary settings when updating API key
        const currentDict = this.corrector.getSettings().correctionDictionary;
        this.corrector = new DictionaryCorrector({
            correctionDictionary: currentDict
        });
    }

    /**
     * Set transcription model
     */
    setModel(model: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe') {
        this.model = model;
    }


    /**
     * Update custom correction dictionary
     */
    setCustomDictionary(dictionary: SimpleCorrectionDictionary) {
        this.corrector.updateCorrectionDictionary(dictionary);
    }

    /**
     * Get corrector instance for dictionary cleanup
     */
    getCorrector(): DictionaryCorrector {
        return this.corrector;
    }

}
