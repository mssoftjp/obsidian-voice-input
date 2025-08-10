/**
 * サービスロケーターパターン
 *
 * CLAUDE.mdの哲学に従った実装:
 * - 根本的な解決: 初期化順序の依存関係を管理
 * - 汎用的な設計: あらゆるサービスに対応
 * - 型安全性: TypeScriptの型システムを活用
 * - 単一責任: サービスの登録と取得のみを担当
 */

import { ErrorHandler } from '../errors';
import { Logger } from '../utils';
import { I18nService } from '../interfaces';

/**
 * サービスのキー
 */
export const ServiceKeys = {
    ERROR_HANDLER: 'ErrorHandler',
    LOGGER_FACTORY: 'LoggerFactory',
    IS_DEVELOPMENT: 'IsDevelopment',
    I18N_SERVICE: 'I18nService'
} as const;

/**
 * サービスタイプのマッピング
 */
interface ServiceTypeMap {
    'ErrorHandler': ErrorHandler;
    'LoggerFactory': (component: string) => Logger;
    'IsDevelopment': boolean;
    'I18nService': I18nService;
}

/**
 * サービスロケーター
 *
 * 初期化順序の問題を解決するためのシングルトン
 */
export class ServiceLocator {
    private static instance: ServiceLocator;
    private services: Map<string, unknown> = new Map();
    private serviceInitializers: Map<string, () => unknown> = new Map();

    private constructor() {
        // Private constructor for singleton pattern
    }

    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(): ServiceLocator {
        if (!ServiceLocator.instance) {
            ServiceLocator.instance = new ServiceLocator();
        }
        return ServiceLocator.instance;
    }

    /**
     * サービスを登録
     */
    register<K extends keyof ServiceTypeMap>(
        key: K,
        service: ServiceTypeMap[K]
    ): void {
        this.services.set(key as string, service);
    }

    /**
     * 遅延初期化サービスを登録
     */
    registerLazy<K extends keyof ServiceTypeMap>(
        key: K,
        initializer: () => ServiceTypeMap[K]
    ): void {
        this.serviceInitializers.set(key as string, initializer);
    }

    /**
     * サービスを取得
     */
    get<K extends keyof ServiceTypeMap>(
        key: K
    ): ServiceTypeMap[K] {
        const keyStr = key as string;

        // すでに初期化されている場合
        if (this.services.has(keyStr)) {
            return this.services.get(keyStr) as ServiceTypeMap[K];
        }

        // 遅延初期化
        if (this.serviceInitializers.has(keyStr)) {
            const initializer = this.serviceInitializers.get(keyStr);
            if (initializer) {
                const service = initializer();
                this.services.set(keyStr, service);
                this.serviceInitializers.delete(keyStr);
                return service as ServiceTypeMap[K];
            }
        }

        throw new Error(`Service not found: ${keyStr}`);
    }

    /**
     * サービスが登録されているかチェック
     */
    has<K extends keyof ServiceTypeMap>(key: K): boolean {
        const keyStr = key as string;
        return this.services.has(keyStr) || this.serviceInitializers.has(keyStr);
    }

    /**
     * すべてのサービスをクリア
     */
    clear(): void {
        this.services.clear();
        this.serviceInitializers.clear();
    }

    /**
     * 特定のサービスを削除
     */
    remove<K extends keyof ServiceTypeMap>(key: K): void {
        const keyStr = key as string;
        this.services.delete(keyStr);
        this.serviceInitializers.delete(keyStr);
    }
}

/**
 * グローバルサービスロケーター
 */
export const serviceLocator = ServiceLocator.getInstance();

/**
 * ヘルパー関数: ErrorHandlerを取得
 */
export function getErrorHandler(): ErrorHandler {
    return serviceLocator.get(ServiceKeys.ERROR_HANDLER);
}

/**
 * ヘルパー関数: Loggerを作成
 */
export function createServiceLogger(component: string): Logger {
    const loggerFactory = serviceLocator.get(ServiceKeys.LOGGER_FACTORY);
    return loggerFactory(component);
}

/**
 * ヘルパー関数: 開発モードかチェック
 */
export function isDevelopmentMode(): boolean {
    return serviceLocator.get(ServiceKeys.IS_DEVELOPMENT);
}

/**
 * ヘルパー関数: I18nServiceを取得
 */
export function getI18n(): I18nService {
    return serviceLocator.get(ServiceKeys.I18N_SERVICE);
}
