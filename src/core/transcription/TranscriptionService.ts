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

    constructor(apiKey: string, dictionary?: SimpleCorrectionDictionary) {
        this.apiKey = apiKey;
        this.logger = createServiceLogger('TranscriptionService');
        this.corrector = new DictionaryCorrector({
            correctionDictionary: dictionary
        });
    }

    async transcribe(audioBlob: Blob, language: string): Promise<TranscriptionResult> {
        return this.transcribeAudio(audioBlob, language);
    }

    async transcribeAudio(audioBlob: Blob, language: string): Promise<TranscriptionResult> {
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
            const prompt = this.buildTranscriptionPrompt(language);
            if (language !== 'auto' && prompt) {
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
            originalText = this.cleanGPT4oResponse(originalText);
            
            
            // プロンプトエラーの検出（音声が無音の場合にプロンプトが返される問題）
            if (originalText.includes('この指示文は出力に含めないでください') || 
                originalText.includes('話者の発言内容だけを正確に記録してください') ||
                originalText === '（話者の発言のみ）' ||
                originalText.trim() === '話者の発言のみ') {
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
            
            // Apply corrections if enabled and for supported languages
            // Use effective language from response or fallback to input language
            const effectiveLang = responseData.language || language;
            const correctedText = this.enableTranscriptionCorrection && effectiveLang === 'ja'
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
    private buildTranscriptionPrompt(language: string): string {
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

    /**
     * Clean GPT-4o specific response artifacts
     */
    private cleanGPT4oResponse(text: string): string {
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

        // Remove specific meta instruction patterns (both at line start and anywhere in text)
        const metaPatterns = [
            /^以下の音声内容.*?$/gm,
            /^この指示文.*?$/gm,
            /^話者の発言内容だけを正確に記録してください.*?$/gm,
            /^話者の発言.*?$/gm,
            /^出力形式.*?$/gm,
            /（話者の発言のみ）/g,  // Remove this specific phrase anywhere in the text
        ];

        // Apply all cleaning patterns
        for (const pattern of metaPatterns) {
            text = text.replace(pattern, '');
        }
        
        // Clean up extra whitespace and empty lines
        text = text.trim();
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^\s*\n/gm, ''); // Remove lines with only whitespace
        text = text.trim();
        
        return text;
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
