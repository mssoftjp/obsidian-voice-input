import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import { getLogger } from '../utils';
import type { Logger } from '../utils';
import { FILE_CONSTANTS } from '../config';

/**
 * Manages draft saving and restoration for Voice Input
 * Ensures consistent behavior across different save scenarios
 */
export class DraftManager {
    private static readonly MAX_DRAFT_SIZE = 1024 * 1024; // 1MB
    private static logger: Logger | null = null;
    private static lastSaveTime = 0;
    private static readonly MIN_SAVE_INTERVAL = 1000; // 1秒の最小間隔

    /**
	 * Get the draft file path using the vault's config directory
	 */
    private static getDraftPath(app: App): string {
        const path = `${app.vault.configDir}/plugins/${FILE_CONSTANTS.PLUGIN_ID}/draft.txt`;
        return normalizePath(path);
    }

    /**
	 * Initialize logger (called once when plugin loads)
	 */
    static initLogger(): void {
        this.logger = getLogger('DraftManager');
    }

    /**
	 * Save draft text to disk
	 * @param app - Obsidian app instance
	 * @param text - Text to save
	 * @param source - Where the save was triggered from (for logging)
	 * @returns true if saved successfully
	 */
    static async saveDraft(app: App, text: string, source: string): Promise<boolean> {
        // Skip if text is empty
        if (!text?.trim()) {
            return false;
        }

        // Prevent too frequent saves (except for critical saves)
        const now = Date.now();
        const criticalSources = ['plugin-unload', 'view-close'];
        if (!criticalSources.includes(source)) {
            if (now - this.lastSaveTime < this.MIN_SAVE_INTERVAL) {
                this.logger?.debug('Draft save skipped (too frequent)', { source, timeSinceLastSave: now - this.lastSaveTime });
                return false;
            }
        }
        this.lastSaveTime = now;

        try {
            // Truncate if too large
            const textToSave = text.length > this.MAX_DRAFT_SIZE
                ? text.substring(0, this.MAX_DRAFT_SIZE)
                : text;

            const draftPath = this.getDraftPath(app);
            await app.vault.adapter.write(draftPath, textToSave);

            this.logger?.info('Draft saved successfully', {
                source,
                textLength: textToSave.length,
                truncated: text.length > this.MAX_DRAFT_SIZE
            });
            return true;
        } catch (error) {
            this.logger?.error('Failed to save draft', error);
            return false;
        }
    }

    /**
	 * Load draft text from disk
	 * @param app - Obsidian app instance
	 * @returns Draft text or null if not found/error
	 */
    static async loadDraft(app: App): Promise<string | null> {
        try {
            const draftPath = this.getDraftPath(app);
            if (!await app.vault.adapter.exists(draftPath)) {
                return null;
            }

            const text = await app.vault.adapter.read(draftPath);
            this.logger?.info('Draft loaded successfully', { textLength: text?.length });
            return text;
        } catch (error) {
            this.logger?.error('Failed to load draft', error);
            return null;
        }
    }

    /**
	 * Clear draft file
	 * @param app - Obsidian app instance
	 */
    static async clearDraft(app: App): Promise<void> {
        try {
            const draftPath = this.getDraftPath(app);
            if (await app.vault.adapter.exists(draftPath)) {
                await app.vault.adapter.remove(draftPath);
                this.logger?.info('Draft cleared successfully');
            }
        } catch (error) {
            this.logger?.error('Failed to clear draft', error);
        }
    }
}
