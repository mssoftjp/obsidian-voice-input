import { WorkspaceLeaf, View } from 'obsidian';
import type { VoiceInputView } from '../views';
import { Logger } from './Logger';

/**
 * Helper utility for safely working with DeferredViews in Obsidian 1.7.2+
 * Provides backward compatibility with older Obsidian versions
 */
export class DeferredViewHelper {
    /**
     * Safely get a view from a leaf, handling deferred views if present
     * @param leaf The workspace leaf to get the view from
     * @returns The view if available, null if deferred and couldn't be loaded
     */
    static async safeGetView<T extends View>(leaf: WorkspaceLeaf): Promise<T | null> {
        try {
            // Check if the leaf has the isDeferred property (Obsidian 1.7.2+)
            if ('isDeferred' in leaf && typeof leaf.isDeferred === 'boolean') {
                if (leaf.isDeferred && 'loadIfDeferred' in leaf && typeof leaf.loadIfDeferred === 'function') {
                    // Load the deferred view
                    await leaf.loadIfDeferred();
                }
            }

            // Return the view if it exists and is of the expected type
            return leaf.view as T | null;
        } catch (error) {
            // Use logger for warning - will be controlled by debugMode in production
            Logger.getInstance().warn('DeferredViewHelper: Failed to load deferred view', error);
            return null;
        }
    }

    /**
     * Safely get a VoiceInputView from a leaf
     * @param leaf The workspace leaf to get the view from
     * @returns The VoiceInputView if available, null otherwise
     */
    static async safeGetVoiceInputView(leaf: WorkspaceLeaf): Promise<VoiceInputView | null> {
        const view = await this.safeGetView<View & { getViewType?: () => string }>(leaf);

        if (!view) {
            return null;
        }

        const viewType = typeof view.getViewType === 'function' ? view.getViewType() : undefined;

        // Do not rely on constructor.name because it is minified in production builds.
        // NOTE: Keep the view type string duplicated here to avoid importing from the view module
        // which can introduce circular dependencies in tests.
        return viewType === 'voice-input-view' ? (view as VoiceInputView) : null;
    }

    /**
     * Check if a leaf is deferred (Obsidian 1.7.2+ only)
     * @param leaf The workspace leaf to check
     * @returns true if deferred, false otherwise (including older Obsidian versions)
     */
    static isDeferred(leaf: WorkspaceLeaf): boolean {
        return 'isDeferred' in leaf && typeof leaf.isDeferred === 'boolean' && leaf.isDeferred;
    }

    /**
     * Safely reveal a leaf and ensure it's loaded
     * @param leaf The workspace leaf to reveal
     * @param workspace The workspace instance
     */
    static async safeRevealLeaf(leaf: WorkspaceLeaf, workspace: { revealLeaf: (leaf: WorkspaceLeaf) => unknown }): Promise<void> {
        try {
            // Use revealLeaf and await it if it returns a promise (Obsidian 1.7.2+)
            const result = workspace.revealLeaf(leaf);
            // Handle both sync and async revealLeaf
            if (result && typeof (result as Promise<unknown>).then === 'function') {
                await (result as Promise<unknown>);
            }
        } catch (error) {
            // Use logger for warning - will be controlled by debugMode in production
            Logger.getInstance().warn('DeferredViewHelper: Failed to reveal leaf', error);
            // Fallback: try calling revealLeaf without awaiting (older versions)
            try {
                workspace.revealLeaf(leaf);
            } catch (fallbackError) {
                // If even the fallback fails, just log and continue
                Logger.getInstance().warn('DeferredViewHelper: Fallback reveal also failed', fallbackError);
            }
        }
    }
}
