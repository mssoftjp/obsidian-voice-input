import type { App } from 'obsidian';
import { normalizePath, TFile, TFolder } from 'obsidian';
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
    private static getDraftFolderPath(app: App): string {
        const path = `${app.vault.configDir}/plugins/${FILE_CONSTANTS.PLUGIN_ID}`;
        return normalizePath(path);
    }

    private static getDraftPath(app: App): string {
        return normalizePath(`${this.getDraftFolderPath(app)}/draft.txt`);
    }

    private static async ensureDraftFolder(app: App): Promise<void> {
        const folderPath = this.getDraftFolderPath(app);
        const abstractFile = app.vault.getAbstractFileByPath(folderPath);

        if (abstractFile instanceof TFolder) {
            return;
        }

        if (abstractFile) {
            this.logger?.warn('Draft path exists but is not a folder', { folderPath });
            return;
        }

        try {
            await app.vault.createFolder(folderPath);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const normalized = message.toLowerCase();
            if (!normalized.includes('already exists')) {
                this.logger?.error('Failed to create draft folder', error);
                throw error;
            }
        }
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
            await this.ensureDraftFolder(app);

            let saved = false;
            const existingFile = app.vault.getFileByPath(draftPath);
            if (existingFile instanceof TFile) {
                try {
                    await app.vault.process(existingFile, () => textToSave);
                    saved = true;
                } catch (error) {
                    this.logger?.warn('Vault.process failed for draft', error);
                }
            } else {
                try {
                    await app.vault.create(draftPath, textToSave);
                    saved = true;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    if (!message.includes('already exists')) {
                        this.logger?.warn('Vault.create failed for draft', error);
                    }
                }
            }

            if (!saved) {
                this.logger?.error('Failed to save draft via Vault API');
                return false;
            }

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
            const draftFile = app.vault.getFileByPath(draftPath);
            if (draftFile instanceof TFile) {
                const text = await app.vault.read(draftFile);
                this.logger?.info('Draft loaded successfully', { textLength: text?.length });
                return text;
            }

            return null;
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
            const draftFile = app.vault.getFileByPath(draftPath);
            if (draftFile) {
                await app.fileManager.trashFile(draftFile);
                this.logger?.info('Draft cleared successfully via file manager');
                return;
            }
        } catch (error) {
            this.logger?.error('Failed to clear draft', error);
        }
    }
}
