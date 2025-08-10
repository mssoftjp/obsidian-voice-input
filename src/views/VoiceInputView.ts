import {
    ItemView,
    WorkspaceLeaf
} from 'obsidian';
import type VoiceInputPlugin from '../plugin';
import { VoiceInputViewUI } from './VoiceInputViewUI';
import { VoiceInputViewActions } from './VoiceInputViewActions';
import { DraftManager } from '../managers';
import { getI18n } from '../services';

export const VIEW_TYPE_VOICE_INPUT = 'voice-input-view';

/**
 * Main Voice Input View - coordinates UI and actions
 */
export class VoiceInputView extends ItemView {
    plugin: VoiceInputPlugin;
    ui: VoiceInputViewUI;
    actions: VoiceInputViewActions;
    private blurHandler: ((e: FocusEvent) => void) | null = null;
    private autoSaveTimeout: NodeJS.Timeout | null = null;
    private periodicSaveInterval: NodeJS.Timeout | null = null;
    private static readonly AUTO_SAVE_DELAY = 2000; // 2 seconds
    private static readonly PERIODIC_SAVE_INTERVAL = 5000; // 5 seconds

    constructor(leaf: WorkspaceLeaf, plugin: VoiceInputPlugin) {
        super(leaf);
        this.plugin = plugin;
        // Note: this.app is available from ItemView base class
    }

    getViewType() {
        return VIEW_TYPE_VOICE_INPUT;
    }

    getDisplayText() {
        return getI18n().t('ui.titles.main');
    }

    getIcon() {
        return 'microphone';
    }

    async onOpen() {
        const containerElement = this.containerEl.children[1];
        if (containerElement instanceof HTMLElement) {
            const container = containerElement;
            container.empty();
            container.addClass('voice-input-view');

            // Capture the last active markdown view is handled by the plugin

            // Initialize components
            this.ui = new VoiceInputViewUI(this, this.plugin, container);
            this.actions = new VoiceInputViewActions(this, this.plugin);

            // Initialize services
            await this.actions.initializeServices();

            // Create UI
            this.ui.createUI();

            // Restore saved draft if exists
            await this.restoreDraft();

            // Set up focus management and auto-save
            this.setupFocusManagement();
            this.setupAutoSaveOnBlur();
            this.setupPeriodicSave();
        }
    }

    async onClose() {
        // Clear any pending auto-save timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }

        // Clear periodic save interval
        if (this.periodicSaveInterval) {
            clearInterval(this.periodicSaveInterval);
            this.periodicSaveInterval = null;
        }

        // Save any text content
        if (this.ui?.textArea?.value) {
            await DraftManager.saveDraft(this.app, this.ui.textArea.value, 'view-close');
        } else {
            // Clear saved draft if textarea is empty
            await DraftManager.clearDraft(this.app);
        }

        // Remove focus event listeners
        this.cleanupFocusManagement();

        // Remove blur handler
        if (this.blurHandler && this.ui?.textArea) {
            this.ui.textArea.removeEventListener('blur', this.blurHandler);
            this.blurHandler = null;
        }

        // Stop recording if active
        if (this.actions.audioRecorder) {
            await this.actions.stopRecording();
        }

        // Clean up
        this.actions.destroy();
        this.ui.destroy();
    }

    /**
	 * Update transcription service when settings change
	 */
    updateTranscriptionService() {
        this.actions.updateTranscriptionService();
    }

    /**
	 * Refresh UI when language changes
	 */
    refreshUI() {
        // Re-create the UI with new language
        const containerElement = this.containerEl.children[1];
        if (containerElement instanceof HTMLElement) {
            const container = containerElement;
            container.empty();
            container.addClass('voice-input-view');

            // Preserve current text content
            const currentText = this.ui?.textArea?.value || '';

            // Re-create UI components
            this.ui = new VoiceInputViewUI(this, this.plugin, container);
            this.ui.createUI();

            // Restore text content
            if (currentText) {
                this.ui.textArea.value = currentText;
            }

            // Re-setup focus management
            this.setupFocusManagement();
            this.setupAutoSaveOnBlur();
            this.setupPeriodicSave();
        }
    }

    /**
	 * Set up focus management to handle recording state
	 */
    private setupFocusManagement() {
        // Removed click outside detection to allow recording to continue
        // when users interact with other parts of Obsidian
    }

    /**
	 * Clean up focus management event listeners
	 */
    private cleanupFocusManagement() {
        // No cleanup needed as click outside detection has been removed
    }

    /**
	 * Set up auto-save when text area loses focus
	 */
    private setupAutoSaveOnBlur() {
        if (!this.ui?.textArea) return;

        // Remove existing handler if any
        if (this.blurHandler) {
            this.ui.textArea.removeEventListener('blur', this.blurHandler);
        }

        // Create and store the handler
        this.blurHandler = async () => {
            if (this.ui?.textArea?.value) {
                await DraftManager.saveDraft(this.app, this.ui.textArea.value, 'focus-lost');
            }
        };

        // Save draft when text area loses focus
        this.ui.textArea.addEventListener('blur', this.blurHandler);
    }

    /**
	 * Restore saved draft text if exists
	 */
    private async restoreDraft() {
        const draftText = await DraftManager.loadDraft(this.app);
        if (draftText && this.ui?.textArea) {
            this.ui.textArea.value = draftText;
            // Show notification that draft was restored
            if (this.actions) {
                const i18n = getI18n();
                this.actions.setStatusWithTimeout(i18n.t('status.draftRestored'));
            }
        }
    }

    /**
	 * Set up periodic auto-save that saves textarea content regardless of state
	 * This simple approach handles all cases including cleared text
	 */
    private setupPeriodicSave() {
        // Clear existing interval if any
        if (this.periodicSaveInterval) {
            clearInterval(this.periodicSaveInterval);
        }

        // Set up periodic save every 5 seconds
        this.periodicSaveInterval = setInterval(async () => {
            if (this.ui?.textArea) {
                const content = this.ui.textArea.value;
                if (content.trim()) {
                    // Save the content
                    await DraftManager.saveDraft(this.app, content, 'periodic-save');
                } else {
                    // Clear the draft when content is empty (handles cleared text)
                    await DraftManager.clearDraft(this.app);
                }
            }
        }, VoiceInputView.PERIODIC_SAVE_INTERVAL);
    }

    /**
	 * Handle text changes with debounced auto-save
	 */
    onTextChanged() {
        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Set new timeout for auto-save (for responsiveness, keeps existing behavior)
        this.autoSaveTimeout = setTimeout(async () => {
            if (this.ui?.textArea) {
                const content = this.ui.textArea.value;
                if (content.trim()) {
                    await DraftManager.saveDraft(this.app, content, 'auto-save');
                } else {
                    // Clear saved draft if textarea is empty
                    await DraftManager.clearDraft(this.app);
                }
            }
        }, VoiceInputView.AUTO_SAVE_DELAY);
    }
}
