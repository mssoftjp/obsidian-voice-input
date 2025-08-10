import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_VOICE_INPUT } from '../views';
import { Disposable } from '../interfaces';
import { Logger } from '../utils';
import { createServiceLogger } from '../services';
import { DeferredViewHelper } from '../utils';

/**
 * ビューの管理を専門に行うマネージャークラス
 * プラグインからビュー管理の責任を分離
 */
export class ViewManager extends Disposable {
    private app: App;
    private lastActiveMarkdownView: MarkdownView | null = null;
    private logger: Logger;

    constructor(app: App) {
        super();
        this.app = app;

        // ServiceLocatorからLoggerを取得
        try {
            this.logger = createServiceLogger('ViewManager');
        } catch (error) {
            // フォールバック: ServiceLocatorが初期化されていない場合
            // 基本のLoggerインスタンスを作成
            this.logger = Logger.getLogger('ViewManager');
            this.logger.warn('ServiceLocator not initialized, using fallback logger');
        }
    }

    /**
     * 最後にアクティブだったマークダウンビューを記録
     */
    recordActiveMarkdownView(): void {
        const currentActiveView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (currentActiveView) {
            this.lastActiveMarkdownView = currentActiveView;
        }
    }

    /**
     * 最後にアクティブだったマークダウンビューを取得
     */
    getLastActiveMarkdownView(): MarkdownView | null {
        // ビューがまだ有効かチェック
        if (this.lastActiveMarkdownView && this.lastActiveMarkdownView.leaf) {
            const leaves = this.app.workspace.getLeavesOfType('markdown');
            if (leaves.some(leaf => leaf === this.lastActiveMarkdownView?.leaf)) {
                return this.lastActiveMarkdownView;
            }
        }
        return null;
    }

    /**
     * Voice Inputビューをアクティブ化
     */
    async activateVoiceInputView(): Promise<void> {
        const { workspace } = this.app;

        // 現在のマークダウンビューを記録
        this.recordActiveMarkdownView();

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_VOICE_INPUT);

        if (leaves.length > 0) {
            // 既存のビューを使用（最初のもののみ）
            leaf = leaves[0];
            // 複数のビューがある場合は警告（通常は発生しないはず）
            if (leaves.length > 1) {
                this.logger.warn('Multiple Voice Input views detected, using the first one', {
                    viewCount: leaves.length
                });
            }
        } else {
            // 新しいビューを作成
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({ type: VIEW_TYPE_VOICE_INPUT, active: true });
            }
        }

        // ビューを表示（DeferredViews対応）
        if (leaf) {
            await DeferredViewHelper.safeRevealLeaf(leaf, workspace);
        }
    }

    /**
     * 適切なマークダウンビューを見つける
     */
    findTargetMarkdownView(): MarkdownView | null {
        // 1. 最後にアクティブだったビューを試す
        const lastActive = this.getLastActiveMarkdownView();
        if (lastActive) {
            return lastActive;
        }

        // 2. 任意のマークダウンビューを探す
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view instanceof MarkdownView) {
                return view;
            }
        }

        // 3. No suitable existing markdown view found
        return null;
    }

    /**
     * すべてのVoice Inputビューをクリーンアップ
     * Note: According to Obsidian plugin guidelines, we don't detach leaves in onunload
     * as this is an antipattern. We only clean up references and let Obsidian handle view lifecycle.
     */
    cleanupVoiceInputViews(): void {
        // Following Obsidian plugin guidelines - we don't detach leaves in cleanup
        // Individual views will handle their own cleanup in their onClose methods
        // This method is kept for consistency but doesn't perform detachment
    }

    /**
     * Disposableパターンの実装
     */
    protected onDispose(): void {
        // Clean up references to existing views without detaching them
        // (following Obsidian plugin guidelines - don't detach leaves in onunload)
        this.cleanupVoiceInputViews();

        // 参照をクリア
        this.lastActiveMarkdownView = null;

        this.logger?.info('ViewManager disposed');
    }

    /**
     * 互換性のためのdestroyメソッド
     * @deprecated dispose()を使用してください
     */
    destroy(): void {
        this.dispose();
    }
}
