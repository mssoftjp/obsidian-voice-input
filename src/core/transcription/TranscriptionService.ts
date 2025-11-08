import { DictionaryCorrector } from './DictionaryCorrector';
import { TranscriptionResult, ITranscriptionProvider, SimpleCorrectionDictionary } from '../../interfaces';
import { TranscriptionError, TranscriptionErrorType } from '../../errors';
import { API_CONSTANTS, DEFAULT_TRANSCRIPTION_SETTINGS, TRANSCRIPTION_MODEL_COSTS } from '../../config';
import { ObsidianHttpClient } from '../../utils/ObsidianHttpClient';
import { createServiceLogger } from '../../services';
import { Logger } from '../../utils';
import { StandardCleaningPipeline } from './cleaning/StandardCleaningPipeline';
import { PromptContaminationCleaner } from './cleaning/PromptContaminationCleaner';
import { UniversalRepetitionCleaner } from './cleaning/UniversalRepetitionCleaner';

// Prompt constants for string drift prevention (文字列ドリフト対策)
const PROMPT_CONSTANTS = {
    JAPANESE: {
        INSTRUCTION_1: '以下の音声内容のみを文字に起こしてください。この指示文は出力に含めないでください。',
        INSTRUCTION_2: '話者の発言内容だけを正確に記録してください。',
        OUTPUT_FORMAT: '出力形式:',
        OUTPUT_FORMAT_FULL_COLON: '出力形式：',
        SPEAKER_ONLY: '（話者の発言のみ）'
    },
    ENGLISH: {
        INSTRUCTION_1: 'Please transcribe only the following audio content. Do not include this instruction in your output.',
        INSTRUCTION_1_CAPS: 'PLEASE TRANSCRIBE ONLY THE FOLLOWING AUDIO CONTENT. DO NOT INCLUDE THIS INSTRUCTION IN YOUR OUTPUT.',
        INSTRUCTION_2: 'Record only the speaker\'s statements accurately.',
        INSTRUCTION_2_CAPS: 'RECORD ONLY THE SPEAKER\'S STATEMENTS ACCURATELY.',
        OUTPUT_FORMAT: 'Output format:',
        OUTPUT_FORMAT_CAPS: 'OUTPUT FORMAT:',
        OUTPUT_FORMAT_FULL_COLON: 'Output format：',
        SPEAKER_ONLY: '(Speaker content only)',
        SPEAKER_ONLY_CAPS: '(SPEAKER CONTENT ONLY)'
    },
    CHINESE: {
        INSTRUCTION_1: '请仅转录以下音频内容。不要包含此指令在输出中。',
        INSTRUCTION_2: '请准确记录说话者的发言内容。',
        OUTPUT_FORMAT: '输出格式:',
        OUTPUT_FORMAT_FULL_COLON: '输出格式：',
        SPEAKER_ONLY: '（仅说话者内容）'
    },
    KOREAN: {
        INSTRUCTION_1: '다음 음성 내용만 전사해주세요. 이 지시사항을 출력에 포함하지 마세요.',
        INSTRUCTION_2: '화자의 발언 내용만 정확히 기록해주세요.',
        OUTPUT_FORMAT: '출력 형식:',
        OUTPUT_FORMAT_FULL_COLON: '출력 형식：',
        SPEAKER_ONLY: '（화자 발언만）'
    },
    GENERIC: {
        OUTPUT_FORMAT: 'Output format:',
        OUTPUT_FORMAT_FULL_COLON: 'Output format：',
        FORMAT: 'Format:'
    }
} as const;

export class TranscriptionService implements ITranscriptionProvider {
    private apiKey: string;
    private corrector: DictionaryCorrector;
    private logger: Logger;
    private cleaningPipeline: StandardCleaningPipeline;
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
        
        // Initialize the new cleaning pipeline
        this.cleaningPipeline = new StandardCleaningPipeline([
            new PromptContaminationCleaner(),
            new UniversalRepetitionCleaner()
        ]);
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
            
            // Language setting (auto 廃止のため常に明示指定)
            formData.append('language', language);

            const prompt = this.buildTranscriptionPrompt(language);
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
            originalText = await this.cleanGPT4oResponse(originalText, language);
            
            
            // プロンプトエラーの検出（音声が無音の場合にプロンプトが返される問題）
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
            
            // Apply corrections if enabled
            const correctedText = this.enableTranscriptionCorrection
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
     * Build prompt for GPT-4o transcription (for all languages except auto)
     */
    private buildTranscriptionPrompt(language: string): string {
        // auto は廃止済み
        
        const normalizedLang = this.normalizeLanguage(language);
        
        switch (normalizedLang) {
            case 'ja':
                return `${PROMPT_CONSTANTS.JAPANESE.INSTRUCTION_1}
${PROMPT_CONSTANTS.JAPANESE.INSTRUCTION_2}

${PROMPT_CONSTANTS.JAPANESE.OUTPUT_FORMAT}
<TRANSCRIPT>
${PROMPT_CONSTANTS.JAPANESE.SPEAKER_ONLY}
</TRANSCRIPT>`;
            
            case 'en':
                return `${PROMPT_CONSTANTS.ENGLISH.INSTRUCTION_1}
${PROMPT_CONSTANTS.ENGLISH.INSTRUCTION_2}

${PROMPT_CONSTANTS.ENGLISH.OUTPUT_FORMAT}
<TRANSCRIPT>
${PROMPT_CONSTANTS.ENGLISH.SPEAKER_ONLY}
</TRANSCRIPT>`;
            
            case 'zh':
                return `${PROMPT_CONSTANTS.CHINESE.INSTRUCTION_1}
${PROMPT_CONSTANTS.CHINESE.INSTRUCTION_2}

${PROMPT_CONSTANTS.CHINESE.OUTPUT_FORMAT}
<TRANSCRIPT>
${PROMPT_CONSTANTS.CHINESE.SPEAKER_ONLY}
</TRANSCRIPT>`;
            
            case 'ko':
                return `${PROMPT_CONSTANTS.KOREAN.INSTRUCTION_1}
${PROMPT_CONSTANTS.KOREAN.INSTRUCTION_2}

${PROMPT_CONSTANTS.KOREAN.OUTPUT_FORMAT}
<TRANSCRIPT>
${PROMPT_CONSTANTS.KOREAN.SPEAKER_ONLY}
</TRANSCRIPT>`;
            
            default:
                // For any other language, return empty string
                return '';
        }
    }

    /**
     * Clean GPT-4o specific response artifacts using the new cleaning pipeline
     * Falls back to legacy cleaning if the pipeline fails
     */
    private async cleanGPT4oResponse(text: string, language: string): Promise<string> {
        const normalizedLang = this.normalizeLanguage(language);
        
        // 1) 先に機械的にTRANSCRIPTタグ等の構造ラッパーを除去してから
        //    パイプラインに渡す（安全判定の基準長もラッパー除去後にする）
        const preStripped = this.preStripTranscriptWrappers(text);
        
        try {
            // Use the new cleaning pipeline
            const result = await this.cleaningPipeline.execute(preStripped, normalizedLang, {
                language: normalizedLang,
                originalLength: preStripped.length,
                enableDetailedLogging: false
            });
            
            return result.finalText.trim().replace(/\n{3,}/g, '\n\n');
            
        } catch (error) {
            // Fall back to legacy cleaning if pipeline fails
            this.logger.warn('Cleaning pipeline failed, falling back to legacy cleaning', error);
            return this.legacyCleanGPT4oResponse(text, language);
        }
    }

    /**
     * Legacy cleaning method (preserved for fallback)
     */
    private legacyCleanGPT4oResponse(text: string, language: string): string {
        // Normalize language for processing
        const normalizedLang = this.normalizeLanguage(language);
        
        // 先に構造ラッパー（TRANSCRIPTタグ）を機械的に除去
        text = this.preStripTranscriptWrappers(text);
        
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
     * TRANSCRIPT系のXMLライクなラッパーを機械的に除去し、中身のテキストを返す
     * - 完全な <TRANSCRIPT> ... </TRANSCRIPT> を優先的に抽出
     * - 閉じタグ欠落時は開きタグ以降を抽出
     * - 残存する TRANSCRIPT 開閉タグは除去
     */
    private preStripTranscriptWrappers(text: string): string {
        let result = text;
        // 完全なタグにマッチ
        const completeMatch = result.match(/<TRANSCRIPT[^>]*>\s*([\s\S]*?)\s*<\/TRANSCRIPT>/);
        if (completeMatch) {
            result = completeMatch[1];
        } else {
            // 開始タグのみ（閉じタグ欠落）に対応
            const openingMatch = result.match(/<TRANSCRIPT[^>]*>\s*([\s\S]*)/);
            if (openingMatch) {
                result = openingMatch[1];
            }
        }
        // 念のため残りの TRANSCRIPT 開閉タグを除去（属性/大小文字変化にもある程度対応）
        result = result.replace(/<\/?TRANSCRIPT[^>]*>/gi, '');
        result = result.replace(/<\/?transcription[^>]*>/gi, '');
        return result;
    }

    /**
     * Normalize language code for consistent processing
     */
    private normalizeLanguage(language: string): string {
        // auto は廃止済み
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
    private applyLanguageSpecificCleaning(text: string, language: string): string {
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
     * Enhanced position guard check - determines if a line should be cleaned based on position
     * Beginning content: first 3 lines or immediately after <TRANSCRIPT> 
     * End content: last 2 lines
     */
    private shouldCleanLine(index: number, totalLines: number, lines: string[], isEndHallucination: boolean = false): boolean {
        // For end hallucination patterns, check last 2 lines
        if (isEndHallucination) {
            return index >= Math.max(0, totalLines - 2);
        }
        
        // For beginning patterns, check first 3 lines
        if (index < 3) {
            return true;
        }
        
        // Check if line comes immediately after <TRANSCRIPT> tag
        if (index > 0 && index < totalLines) {
            const previousLine = lines[index - 1].trim();
            if (previousLine === '<TRANSCRIPT>' || previousLine.includes('<TRANSCRIPT>')) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Apply Japanese-specific cleaning patterns - using exact line matching with enhanced position guard for safety
     */
    private applyJapaneseCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = [];
        
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const trimmedLine = line.trim();
            
            // Only remove lines that exactly match prompt instructions AND are in protected position
            if (this.shouldCleanLine(index, lines.length, lines) && (
                trimmedLine === PROMPT_CONSTANTS.JAPANESE.INSTRUCTION_1 ||
                trimmedLine === PROMPT_CONSTANTS.JAPANESE.INSTRUCTION_2 ||
                trimmedLine === PROMPT_CONSTANTS.JAPANESE.OUTPUT_FORMAT ||
                trimmedLine === PROMPT_CONSTANTS.JAPANESE.OUTPUT_FORMAT_FULL_COLON ||
                trimmedLine === PROMPT_CONSTANTS.JAPANESE.SPEAKER_ONLY
            )) {
                // Skip this line - don't add to cleanedLines
                continue;
            }
            
            // Apply phrase removal only to protected positions
            let cleanedLine = line;
            if (this.shouldCleanLine(index, lines.length, lines)) {
                cleanedLine = cleanedLine.replace(new RegExp(PROMPT_CONSTANTS.JAPANESE.SPEAKER_ONLY.replace(/[()（）]/g, '\\$&'), 'g'), '');
            }
            
            cleanedLines.push(cleanedLine);
        }

        return cleanedLines.join('\n');
    }

    /**
     * Apply English-specific cleaning patterns - using exact line matching with enhanced position guard for safety
     */
    private applyEnglishCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = [];
        
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const trimmedLine = line.trim();
            
            // Only remove lines that exactly match prompt instructions AND are in protected position
            if (this.shouldCleanLine(index, lines.length, lines) && (
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.INSTRUCTION_1 ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.INSTRUCTION_1_CAPS ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.INSTRUCTION_2 ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.INSTRUCTION_2_CAPS ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.OUTPUT_FORMAT ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.OUTPUT_FORMAT_CAPS ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.OUTPUT_FORMAT_FULL_COLON ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.SPEAKER_ONLY ||
                trimmedLine === PROMPT_CONSTANTS.ENGLISH.SPEAKER_ONLY_CAPS
            )) {
                // Skip this line - don't add to cleanedLines
                continue;
            }
            
            // Apply phrase removal only to protected positions
            let cleanedLine = line;
            if (this.shouldCleanLine(index, lines.length, lines)) {
                cleanedLine = cleanedLine.replace(/\(Speaker content only\)/g, '');
                cleanedLine = cleanedLine.replace(/\(SPEAKER CONTENT ONLY\)/g, '');
            }
            
            cleanedLines.push(cleanedLine);
        }

        return cleanedLines.join('\n');
    }

    /**
     * Apply Chinese-specific cleaning patterns - using exact line matching with enhanced position guard for safety
     */
    private applyChineseCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = [];
        
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const trimmedLine = line.trim();
            
            // Only remove lines that exactly match prompt instructions AND are in protected position
            if (this.shouldCleanLine(index, lines.length, lines) && (
                trimmedLine === PROMPT_CONSTANTS.CHINESE.INSTRUCTION_1 ||
                trimmedLine === PROMPT_CONSTANTS.CHINESE.INSTRUCTION_2 ||
                trimmedLine === PROMPT_CONSTANTS.CHINESE.OUTPUT_FORMAT ||
                trimmedLine === PROMPT_CONSTANTS.CHINESE.OUTPUT_FORMAT_FULL_COLON ||
                trimmedLine === PROMPT_CONSTANTS.CHINESE.SPEAKER_ONLY
            )) {
                // Skip this line - don't add to cleanedLines
                continue;
            }
            
            // Apply phrase removal only to protected positions
            let cleanedLine = line;
            if (this.shouldCleanLine(index, lines.length, lines)) {
                cleanedLine = cleanedLine.replace(/（仅说话者内容）/g, '');
            }
            
            cleanedLines.push(cleanedLine);
        }

        return cleanedLines.join('\n');
    }

    /**
     * Apply Korean-specific cleaning patterns - using exact line matching with enhanced position guard for safety
     */
    private applyKoreanCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = [];
        
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const trimmedLine = line.trim();
            
            // Only remove lines that exactly match prompt instructions AND are in protected position
            if (this.shouldCleanLine(index, lines.length, lines) && (
                trimmedLine === PROMPT_CONSTANTS.KOREAN.INSTRUCTION_1 ||
                trimmedLine === PROMPT_CONSTANTS.KOREAN.INSTRUCTION_2 ||
                trimmedLine === PROMPT_CONSTANTS.KOREAN.OUTPUT_FORMAT ||
                trimmedLine === PROMPT_CONSTANTS.KOREAN.OUTPUT_FORMAT_FULL_COLON ||
                trimmedLine === PROMPT_CONSTANTS.KOREAN.SPEAKER_ONLY
            )) {
                // Skip this line - don't add to cleanedLines
                continue;
            }
            
            // Apply phrase removal only to protected positions
            let cleanedLine = line;
            if (this.shouldCleanLine(index, lines.length, lines)) {
                cleanedLine = cleanedLine.replace(/（화자 발언만）/g, '');
            }
            
            cleanedLines.push(cleanedLine);
        }

        return cleanedLines.join('\n');
    }

    /**
     * Apply generic cleaning patterns (conservative approach) - using exact line matching with enhanced position guard for safety
     */
    private applyGenericCleaning(text: string): string {
        // Split into lines for exact line matching
        const lines = text.split('\n');
        const cleanedLines = [];
        
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const trimmedLine = line.trim();
            
            // Only remove lines that exactly match generic format instructions AND are in protected position
            if (this.shouldCleanLine(index, lines.length, lines) && (
                trimmedLine === PROMPT_CONSTANTS.GENERIC.OUTPUT_FORMAT ||
                trimmedLine === PROMPT_CONSTANTS.GENERIC.OUTPUT_FORMAT_FULL_COLON ||
                trimmedLine === PROMPT_CONSTANTS.GENERIC.FORMAT
            )) {
                // Skip this line - don't add to cleanedLines
                continue;
            }
            
            cleanedLines.push(line);
        }

        return cleanedLines.join('\n');
    }

    /**
     * Detect prompt error patterns by language
     */
    private isPromptErrorDetected(text: string, language: string): boolean {
        const normalizedLang = this.normalizeLanguage(language);
        
        switch (normalizedLang) {
            case 'ja':
                return text.includes('この指示文は出力に含めないでください') || 
                       text.includes(PROMPT_CONSTANTS.JAPANESE.INSTRUCTION_2) ||
                       text === PROMPT_CONSTANTS.JAPANESE.SPEAKER_ONLY ||
                       text.trim() === '話者の発言のみ';
            case 'en':
                return text.includes('Please transcribe only the speaker') ||
                       text.includes('Do not include this instruction') ||
                       text.trim() === PROMPT_CONSTANTS.ENGLISH.SPEAKER_ONLY ||
                       text.trim() === PROMPT_CONSTANTS.ENGLISH.SPEAKER_ONLY_CAPS;
            case 'zh':
                return text.includes('请仅转录说话者') ||
                       text.includes('不要包含此指令') ||
                       text.trim() === PROMPT_CONSTANTS.CHINESE.SPEAKER_ONLY;
            case 'ko':
                return text.includes('화자의 발언만 전사해주세요') ||
                       text.includes('이 지시사항을 포함하지 마세요') ||
                       text.trim() === PROMPT_CONSTANTS.KOREAN.SPEAKER_ONLY;
            default:
                // For auto and other languages, use Japanese patterns as fallback
                return text.includes('この指示文は出力に含めないでください') || 
                       text.includes(PROMPT_CONSTANTS.JAPANESE.INSTRUCTION_2) ||
                       text === PROMPT_CONSTANTS.JAPANESE.SPEAKER_ONLY ||
                       text.trim() === '話者の発言のみ';
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
    private convertToWav(audioBlob: Blob): Blob {
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
        // Delegate to a single code path to keep states in sync
        this.updateCorrectorSettings({ enabled });
    }

    /**
     * Update API key
     */
    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
        // Preserve existing corrector settings when updating API key
        const currentSettings = this.corrector.getSettings();
        this.corrector = new DictionaryCorrector({
            enabled: currentSettings.enabled,
            correctionDictionary: currentSettings.correctionDictionary
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
