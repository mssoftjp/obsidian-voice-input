/**
 * Disposableパターンのインターフェース
 *
 * CLAUDE.md の哲学に従った実装:
 * - 根本的な解決: リソース管理の体系化
 * - 汎用的な設計: あらゆるリソースに適用可能
 * - 型安全性: TypeScriptの型システムを活用
 * - エラーハンドリング: 適切なクリーンアップ保証
 */

import { Logger } from '../utils';

/**
 * リソースの解放を保証するインターフェース
 */
export interface IDisposable {
    /**
     * リソースを解放する
     * - 複数回呼ばれても安全であること（冪等性）
     * - エラーを投げないこと
     */
    dispose(): void;

    /**
     * リソースが既に解放されているかどうか
     */
    readonly isDisposed: boolean;
}

/**
 * 非同期でリソースを解放するインターフェース
 */
export interface IAsyncDisposable {
    /**
     * リソースを非同期で解放する
     * - 複数回呼ばれても安全であること（冪等性）
     * - エラーを投げないこと
     */
    disposeAsync(): Promise<void>;

    /**
     * リソースが既に解放されているかどうか
     */
    readonly isDisposed: boolean;
}

/**
 * Disposableパターンの基本実装
 */
export abstract class Disposable implements IDisposable {
    private _isDisposed = false;

    /**
     * リソースが既に解放されているかどうか
     */
    get isDisposed(): boolean {
        return this._isDisposed;
    }

    /**
     * リソースを解放する
     */
    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        try {
            this.onDispose();
        } finally {
            this._isDisposed = true;
        }
    }

    /**
     * 派生クラスでオーバーライドして、実際のリソース解放処理を実装する
     */
    protected abstract onDispose(): void;

    /**
     * リソースが解放されていることを確認する
     * @throws Error リソースが既に解放されている場合
     */
    protected throwIfDisposed(): void {
        if (this._isDisposed) {
            throw new Error(`${this.constructor.name} has been disposed`);
        }
    }
}

/**
 * 非同期Disposableパターンの基本実装
 */
export abstract class AsyncDisposable implements IAsyncDisposable {
    private _isDisposed = false;

    /**
     * リソースが既に解放されているかどうか
     */
    get isDisposed(): boolean {
        return this._isDisposed;
    }

    /**
     * リソースを非同期で解放する
     */
    async disposeAsync(): Promise<void> {
        if (this._isDisposed) {
            return;
        }

        try {
            await this.onDisposeAsync();
        } finally {
            this._isDisposed = true;
        }
    }

    /**
     * 派生クラスでオーバーライドして、実際のリソース解放処理を実装する
     */
    protected abstract onDisposeAsync(): Promise<void>;

    /**
     * リソースが解放されていることを確認する
     * @throws Error リソースが既に解放されている場合
     */
    protected throwIfDisposed(): void {
        if (this._isDisposed) {
            throw new Error(`${this.constructor.name} has been disposed`);
        }
    }
}

/**
 * 複数のDisposableを管理するクラス
 */
export class CompositeDisposable implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    private _isDisposed = false;
    private static logger = Logger.getLogger('CompositeDisposable');

    /**
     * リソースが既に解放されているかどうか
     */
    get isDisposed(): boolean {
        return this._isDisposed;
    }

    /**
     * Disposableを追加する
     */
    add(disposable: IDisposable): void {
        if (this._isDisposed) {
            disposable.dispose();
            return;
        }

        this.disposables.push(disposable);
    }

    /**
     * 全てのリソースを解放する
     */
    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        // 逆順で解放（依存関係を考慮）
        for (let i = this.disposables.length - 1; i >= 0; i--) {
            try {
                this.disposables[i].dispose();
            } catch (error) {
                // エラーをログに記録するが、処理は継続
                CompositeDisposable.logger.error('Error disposing resource', error);
            }
        }

        this.disposables.length = 0;
        this._isDisposed = true;
    }
}

/**
 * Disposableのユーティリティ関数
 */
export const DisposableUtils = {
    /**
     * 関数をDisposableとしてラップする
     */
    fromFunction(fn: () => void): IDisposable {
        return new FunctionDisposable(fn);
    },

    /**
     * 複数のDisposableを安全に解放する
     */
    disposeAll(...disposables: (IDisposable | undefined | null)[]): void {
        for (const disposable of disposables) {
            if (disposable && !disposable.isDisposed) {
                try {
                    disposable.dispose();
                } catch (error) {
                    // Use logger for error reporting - will be controlled by debugMode in production
                    Logger.getInstance().error('Error disposing resource:', error);
                }
            }
        }
    }
};

/**
 * 関数をラップするDisposable
 */
class FunctionDisposable extends Disposable {
    constructor(private readonly fn: () => void) {
        super();
    }

    protected onDispose(): void {
        this.fn();
    }
}
