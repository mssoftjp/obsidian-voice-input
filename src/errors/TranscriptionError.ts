import { getI18n } from '../services';
import type { I18nService } from '../interfaces';

export enum TranscriptionErrorType {
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
    INVALID_API_KEY = 'INVALID_API_KEY',
    AUDIO_DEVICE_ERROR = 'AUDIO_DEVICE_ERROR',
    AUDIO_INITIALIZATION_FAILED = 'AUDIO_INITIALIZATION_FAILED',
    VAD_INITIALIZATION_ERROR = 'VAD_INITIALIZATION_ERROR',
    TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
    AUDIO_PROCESSING_ERROR = 'AUDIO_PROCESSING_ERROR',
    SERVICE_NOT_INITIALIZED = 'SERVICE_NOT_INITIALIZED',
    API_ERROR = 'API_ERROR'
}

export class TranscriptionError extends Error {
    constructor(
        public type: TranscriptionErrorType,
        message: string,
        public recoverable: boolean = false,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'TranscriptionError';
    }

    static fromError(error: unknown, type: TranscriptionErrorType): TranscriptionError {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        const originalError = error instanceof Error ? error : undefined;
        return new TranscriptionError(type, message, false, originalError);
    }

    getLocalizedMessage(): string {
        let i18n: I18nService | null = null;

        try {
            i18n = getI18n();
        } catch (error) {
            // Fallback to original message if i18n is not available
            return this.message;
        }

        const errorTypeToI18nKey: Record<TranscriptionErrorType, string> = {
            [TranscriptionErrorType.PERMISSION_DENIED]: 'error.audio.micPermission',
            [TranscriptionErrorType.NETWORK_ERROR]: 'error.general.network',
            [TranscriptionErrorType.API_QUOTA_EXCEEDED]: 'error.api.quotaExceeded',
            [TranscriptionErrorType.INVALID_API_KEY]: 'error.api.unauthorized',
            [TranscriptionErrorType.AUDIO_DEVICE_ERROR]: 'error.audio.micNotFound',
            [TranscriptionErrorType.AUDIO_INITIALIZATION_FAILED]: 'error.audio.audioContextFailed',
            [TranscriptionErrorType.VAD_INITIALIZATION_ERROR]: 'error.file.wasmLoadFailed',
            [TranscriptionErrorType.TRANSCRIPTION_FAILED]: 'error.transcription.failed',
            [TranscriptionErrorType.AUDIO_PROCESSING_ERROR]: 'error.audio.audioContextFailed',
            [TranscriptionErrorType.SERVICE_NOT_INITIALIZED]: 'error.transcription.serviceInitFailed',
            [TranscriptionErrorType.API_ERROR]: 'error.api.connectionFailed'
        };

        const i18nKey = errorTypeToI18nKey[this.type];
        return i18nKey ? i18n.t(i18nKey) : this.message;
    }
}
