/**
 * エラーハンドリングの体系化
 *
 * CLAUDE.mdの哲学に従った実装:
 * - 根本的な解決: エラー処理の一元化
 * - 汎用的な設計: あらゆるエラーパターンに対応
 * - 型安全性: TypeScriptの型システムを活用
 * - エラーリカバリー: 適切な復旧処理
 */

import { Notice } from 'obsidian';
import { TranscriptionError, TranscriptionErrorType } from './TranscriptionError';
import type { IDisposable } from '../interfaces';
import { getI18n } from '../services';
import type { I18nService } from '../interfaces';
import { Logger } from '../utils';

/**
 * エラーの重要度レベル
 */
export enum ErrorSeverity {
    /** 致命的 - プラグインの動作を停止すべき */
    FATAL = 'fatal',
    /** エラー - 機能は動作しないが、プラグインは継続可能 */
    ERROR = 'error',
    /** 警告 - 機能は動作するが、問題がある */
    WARNING = 'warning',
    /** 情報 - ユーザーに通知すべき情報 */
    INFO = 'info'
}

/**
 * エラーコンテキスト情報
 */
export interface ErrorContext {
    /** エラーが発生したコンポーネント */
    component: string;
    /** エラー発生時の操作 */
    operation: string;
    /** 追加のメタデータ */
    metadata?: Record<string, unknown>;
    /** エラー発生時刻 */
    timestamp: Date;
}

/**
 * エラーハンドラーのオプション
 */
export interface ErrorHandlerOptions {
    /** 開発モードかどうか */
    isDevelopment: boolean;
    /** エラーログの最大保持数 */
    maxErrorLogs: number;
    /** リトライの最大回数 */
    maxRetries: number;
    /** リトライの基本待機時間 (ms) */
    retryBaseDelay: number;
}

/**
 * エラーログエントリ
 */
interface ErrorLogEntry {
    error: Error;
    context: ErrorContext;
    severity: ErrorSeverity;
    timestamp: Date;
    handled: boolean;
}

/**
 * リトライ可能な操作の定義
 */
export interface RetryableOperation<T> {
    /** 実行する操作 */
    operation: () => Promise<T>;
    /** リトライ可能かどうかを判定する関数 */
    isRetryable?: (error: Error) => boolean;
    /** リトライ前のクリーンアップ処理 */
    onRetry?: (attempt: number, error: Error) => Promise<void>;
}

/**
 * グローバルエラーハンドラー
 */
export class ErrorHandler implements IDisposable {
    private static instance: ErrorHandler;
    private errorLogs: ErrorLogEntry[] = [];
    private options: ErrorHandlerOptions;
    private _isDisposed = false;
    private unhandledRejectionHandler?: (event: PromiseRejectionEvent) => void;
    private errorHandler?: (event: ErrorEvent) => void;
    private i18n?: I18nService;
    private logger: Logger;

    private constructor(options: Partial<ErrorHandlerOptions> = {}) {
        this.options = {
            isDevelopment: false,
            maxErrorLogs: 100,
            maxRetries: 3,
            retryBaseDelay: 1000,
            ...options
        };
        this.logger = Logger.getLogger('ErrorHandler');

        // i18n service might not be available yet during initialization
        try {
            this.i18n = getI18n();
        } catch {
            // i18n service will be available later
        }

        this.setupGlobalHandlers();
    }

    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(options?: Partial<ErrorHandlerOptions>): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler(options);
        }
        return ErrorHandler.instance;
    }

    /**
     * グローバルエラーハンドラーの設定
     */
    private setupGlobalHandlers(): void {
        // Unhandled promise rejections
        this.unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
            // Filter out errors that are not from our plugin
            const reasonSummary = this.describeReason(event.reason);

            // Ignore errors from other plugins/sources
            if (reasonSummary.includes('inputEl') ||
                reasonSummary.includes('Cannot read properties of undefined') ||
                !reasonSummary.includes('voice-input')) {
                // Log in development mode only
                if (this.options.isDevelopment) {
                    this.logger.debug('[VoiceInput] Ignored external error', { reason: reasonSummary });
                }
                return;
            }

            this.handleError(
                new Error(`Unhandled Promise Rejection: ${reasonSummary}`),
                {
                    component: 'Global',
                    operation: 'UnhandledRejection',
                    metadata: { reason: event.reason },
                    timestamp: new Date()
                },
                ErrorSeverity.ERROR
            );
            event.preventDefault();
        };

        // Global error events
        this.errorHandler = (event: ErrorEvent) => {
            const eventError = event.error instanceof Error ? event.error : new Error(event.message);
            this.handleError(
                eventError,
                {
                    component: 'Global',
                    operation: 'UncaughtError',
                    metadata: {
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    },
                    timestamp: new Date()
                },
                ErrorSeverity.ERROR
            );
        };

        window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
        window.addEventListener('error', this.errorHandler);
    }

    /**
     * エラーを処理する
     */
    handleError(
        error: Error,
        context: ErrorContext,
        severity: ErrorSeverity = ErrorSeverity.ERROR
    ): void {
        if (this._isDisposed) return;

        // エラーログに記録
        const logEntry: ErrorLogEntry = {
            error,
            context,
            severity,
            timestamp: new Date(),
            handled: true
        };

        this.addErrorLog(logEntry);

        // コンソールにログ出力
        this.logError(error, context, severity);

        // ユーザーへの通知
        if (severity !== ErrorSeverity.INFO) {
            this.notifyUser(error, severity);
        }
    }

    /**
     * リトライ可能な操作を実行
     */
    async executeWithRetry<T>(
        retryableOp: RetryableOperation<T>,
        context: ErrorContext
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
            try {
                return await retryableOp.operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // リトライ可能かチェック
                const isRetryable = retryableOp.isRetryable?.(lastError) ?? true;
                if (!isRetryable || attempt === this.options.maxRetries - 1) {
                    throw lastError;
                }

                // リトライ前のクリーンアップ
                if (retryableOp.onRetry) {
                    await retryableOp.onRetry(attempt + 1, lastError);
                }

                // 指数バックオフで待機
                const delay = this.options.retryBaseDelay * Math.pow(2, attempt);
                await this.delay(delay);

                // リトライをログに記録
                this.logRetry(attempt + 1, lastError, context);
            }
        }

        let contextSummary: string;
        try {
            contextSummary = JSON.stringify(context);
        } catch {
            contextSummary = '[Unserializable context]';
        }
        throw lastError || new Error(`Retry operation failed after ${this.options.maxRetries} attempts in context: ${contextSummary}`);
    }

    /**
     * エラーログに追加
     */
    private addErrorLog(entry: ErrorLogEntry): void {
        this.errorLogs.push(entry);

        // 最大数を超えたら古いものから削除
        if (this.errorLogs.length > this.options.maxErrorLogs) {
            this.errorLogs = this.errorLogs.slice(-this.options.maxErrorLogs);
        }
    }

    /**
     * エラーをコンソールにログ出力
     */
    private logError(error: Error, context: ErrorContext, severity: ErrorSeverity): void {
        const logData = {
            severity,
            component: context.component,
            operation: context.operation,
            message: error.message,
            metadata: context.metadata,
            timestamp: context.timestamp.toISOString()
        };

        const detailedLog = {
            ...logData,
            stack: error.stack,
            name: error.name
        };

        if (this.options.isDevelopment) {
            this.logger.debug(
                `[${severity.toUpperCase()}] ${context.component}.${context.operation}`,
                detailedLog
            );
            return;
        }

        // 本番モードでは簡潔に
        switch (severity) {
            case ErrorSeverity.FATAL:
            case ErrorSeverity.ERROR:
                console.error(`[${context.component}] ${error.message}`, logData);
                break;
            case ErrorSeverity.WARNING:
                this.logger.warn(`[${context.component}] ${error.message}`, logData);
                break;
            case ErrorSeverity.INFO:
                this.logger.debug(`[${context.component}] ${error.message}`, logData);
                break;
        }
    }

    /**
     * リトライをログに記録
     */
    private logRetry(attempt: number, error: Error, context: ErrorContext): void {
        if (this.options.isDevelopment) {
            this.logger.warn(
                `[RETRY] Attempt ${attempt}/${this.options.maxRetries} for ${context.component}.${context.operation}`,
                { error: error.message }
            );
        }
    }

    private describeReason(reason: unknown): string {
        if (typeof reason === 'string') {
            return reason;
        }
        if (reason instanceof Error) {
            return reason.message || reason.name;
        }
        try {
            return JSON.stringify(reason);
        } catch {
            return String(reason);
        }
    }

    /**
     * ユーザーに通知
     */
    private notifyUser(error: Error, severity: ErrorSeverity): void {
        let message: string;

        if (error instanceof TranscriptionError) {
            message = error.getLocalizedMessage();
        } else {
            // 一般的なエラーメッセージ
            message = this.getGenericErrorMessage(severity);
        }

        new Notice(message, severity === ErrorSeverity.FATAL ? 0 : 5000);
    }

    /**
     * 一般的なエラーメッセージを取得
     */
    private getGenericErrorMessage(severity: ErrorSeverity): string {
        // Try to get i18n service if not available yet
        if (!this.i18n) {
            try {
                this.i18n = getI18n();
            } catch {
                // Fallback to English messages
                switch (severity) {
                    case ErrorSeverity.FATAL:
                        return 'A fatal error occurred';
                    case ErrorSeverity.ERROR:
                        return 'An error occurred';
                    case ErrorSeverity.WARNING:
                        return 'Warning';
                    default:
                        return 'Unknown error';
                }
            }
        }

        switch (severity) {
            case ErrorSeverity.FATAL:
                return this.i18n.t('error.general.fatal');
            case ErrorSeverity.ERROR:
                return this.i18n.t('error.general.error');
            case ErrorSeverity.WARNING:
                return this.i18n.t('error.general.warning');
            default:
                return this.i18n.t('error.general.default');
        }
    }

    /**
     * 遅延処理
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * エラーログを取得
     */
    getErrorLogs(): ReadonlyArray<ErrorLogEntry> {
        return [...this.errorLogs];
    }

    /**
     * エラーログをクリア
     */
    clearErrorLogs(): void {
        this.errorLogs = [];
    }

    /**
     * リソースの解放
     */
    dispose(): void {
        if (this._isDisposed) return;

        if (this.unhandledRejectionHandler) {
            window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
        }

        if (this.errorHandler) {
            window.removeEventListener('error', this.errorHandler);
        }

        this.errorLogs = [];
        this._isDisposed = true;
    }

    get isDisposed(): boolean {
        return this._isDisposed;
    }
}

/**
 * エラーハンドリングのヘルパー関数
 */
export const ErrorHandlerUtils = {
    /**
     * TranscriptionErrorに変換
     */
    toTranscriptionError(
        error: unknown,
        defaultType: TranscriptionErrorType = TranscriptionErrorType.TRANSCRIPTION_FAILED
    ): TranscriptionError {
        if (error instanceof TranscriptionError) {
            return error;
        }

        return TranscriptionError.fromError(error, defaultType);
    },

    /**
     * エラーが特定のタイプかチェック
     */
    isErrorType(error: unknown, type: TranscriptionErrorType): boolean {
        return error instanceof TranscriptionError && error.type === type;
    },

    /**
     * ネットワークエラーかチェック
     */
    isNetworkError(error: unknown): boolean {
        if (error instanceof TranscriptionError) {
            return error.type === TranscriptionErrorType.NETWORK_ERROR;
        }

        if (error instanceof Error) {
            return error.message.toLowerCase().includes('network') ||
                   error.message.toLowerCase().includes('fetch');
        }

        return false;
    },

    /**
     * APIエラーかチェック
     */
    isApiError(error: unknown): boolean {
        if (error instanceof TranscriptionError) {
            return [
                TranscriptionErrorType.API_ERROR,
                TranscriptionErrorType.API_QUOTA_EXCEEDED,
                TranscriptionErrorType.INVALID_API_KEY
            ].includes(error.type);
        }

        return false;
    }
};
