import { UI_CONSTANTS } from '../config';
import { Notice, Setting, ToggleComponent, DropdownComponent, setIcon } from 'obsidian';
import type { VoiceInputView } from './VoiceInputView';
import type VoiceInputPlugin from '../plugin';
import { getI18n } from '../services';
import type { I18nService } from '../interfaces';
import { hasInternalSettingAPI } from '../types';

/**
 * Handles UI creation and management for the Voice Input View
 */
export class VoiceInputViewUI {
    private view: VoiceInputView;
    private i18n: I18nService;

    // UI elements
    container: HTMLElement;
    textArea: HTMLTextAreaElement;
    recordButton: HTMLButtonElement;
    cancelButton: HTMLButtonElement;
    formatButton: HTMLButtonElement;
    contextCorrectionButton: HTMLButtonElement;
    cleanupButton: HTMLButtonElement;
    clipboardButton: HTMLButtonElement;
    insertButton: HTMLButtonElement;
    insertAtCursorButton: HTMLButtonElement;
    appendButton: HTMLButtonElement;
    clearButton: HTMLButtonElement;
    statusEl: HTMLElement;
    visualizerContainer: HTMLElement;
    settingsContainer: HTMLElement;
    firstRowContainer: HTMLElement;
    secondRowContainer: HTMLElement;

    // Settings controls
    correctionToggle: ToggleComponent | null = null;
    transcriptionModelDropdown: DropdownComponent | null = null;

    // Event handlers
    private clickHandler: ((e: MouseEvent) => void) | null = null;
    private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
    private mouseUpHandler: (() => void) | null = null;
    private mouseLeaveHandler: (() => void) | null = null;
    private touchStartHandler: ((e: TouchEvent) => void) | null = null;
    private touchEndHandler: ((e: TouchEvent) => void) | null = null;
    private textChangeHandler: ((e: Event) => void) | null = null;

    constructor(view: VoiceInputView, plugin: VoiceInputPlugin, container: HTMLElement) {
        this.view = view;
        this.container = container;
        this.i18n = getI18n();
    }

    get plugin(): VoiceInputPlugin {
        return this.view.plugin;
    }

    get app() {
        return this.view.app;
    }

    /**
	 * Create all UI elements
	 */
    createUI() {
        // Title bar with settings button
        const titleBar = this.container.createDiv('voice-input-title-bar');
        const titleEl = titleBar.createEl('h3', { text: this.i18n.t('ui.titles.main') });
        titleEl.addClass('voice-input-title');

        // Settings gear button
        const settingsButton = titleBar.createEl('button', {
            cls: 'voice-input-settings-button'
        });
        setIcon(settingsButton, 'settings');
        settingsButton.setAttribute('aria-label', this.i18n.t('ui.tooltips.settingsButton'));
        settingsButton.addEventListener('click', () => {
            // Open settings tab using type-safe approach
            if (hasInternalSettingAPI(this.app) && this.app.setting) {
                this.app.setting.open();
                this.app.setting.openTabById(this.plugin.manifest.id);
            } else {
                new Notice('Settings panel is not available');
            }
        });

        // Settings panel
        this.settingsContainer = this.container.createDiv('voice-input-settings-panel');
        this.createSettingsPanel();

        // Visualizer container
        this.visualizerContainer = this.container.createDiv('voice-input-visualizer');

        // Status display container (between visualizer and text area)
        const statusContainer = this.container.createDiv('voice-input-status-container');
        this.statusEl = statusContainer.createEl('div', {
            text: this.i18n.t('status.idle'),
            cls: 'voice-input-status-text'
        });

        // Text area
        const textContainer = this.container.createDiv('voice-input-text-container');
        this.textArea = textContainer.createEl('textarea', {
            placeholder: this.i18n.t('ui.placeholders.textarea'),
            cls: 'voice-input-textarea'
        });

        // Setup auto-save on text changes
        this.setupTextChangeListener();

        // First row buttons (コピー、クリア)
        this.firstRowContainer = this.container.createDiv('voice-input-button-group voice-input-action-buttons');

        // Copy button
        this.clipboardButton = this.firstRowContainer.createEl('button', {
            cls: 'voice-input-button'
        });
        this.clipboardButton.createEl('span', {
            cls: 'voice-input-button-text',
            text: this.i18n.t('ui.buttons.copy')
        });
        this.clipboardButton.setAttribute('aria-label', this.i18n.t('ui.tooltips.copy'));
        this.clipboardButton.addEventListener('click', () => {
            this.runAction(() => this.view.actions.copyToClipboard(), 'Failed to copy text to clipboard');
        });

        // Clear button
        this.clearButton = this.firstRowContainer.createEl('button', {
            cls: 'voice-input-button'
        });
        this.clearButton.createEl('span', {
            cls: 'voice-input-button-text',
            text: this.i18n.t('ui.buttons.clear')
        });
        this.clearButton.setAttribute('aria-label', this.i18n.t('ui.tooltips.clear'));
        this.clearButton.addEventListener('click', () => {
            this.view.actions.clearText();
        });

        // Second row buttons (カーソル位置に挿入、末尾に挿入)
        this.secondRowContainer = this.container.createDiv('voice-input-button-group voice-input-action-buttons');

        // Insert at cursor button
        this.insertAtCursorButton = this.secondRowContainer.createEl('button', {
            cls: 'voice-input-button'
        });
        this.insertAtCursorButton.createEl('span', {
            cls: 'voice-input-button-text',
            text: this.i18n.t('ui.buttons.insertAtCursor')
        });
        this.insertAtCursorButton.setAttribute('aria-label', this.i18n.t('ui.tooltips.insertAtCursor'));
        this.insertAtCursorButton.addEventListener('click', () => {
            this.runAction(() => this.view.actions.insertToNote(), 'Failed to insert text at cursor');
        });

        // Append button
        this.appendButton = this.secondRowContainer.createEl('button', {
            cls: 'voice-input-button'
        });
        this.appendButton.createEl('span', {
            cls: 'voice-input-button-text',
            text: this.i18n.t('ui.buttons.append')
        });
        this.appendButton.setAttribute('aria-label', this.i18n.t('ui.tooltips.append'));
        this.appendButton.addEventListener('click', () => {
            this.runAction(() => this.view.actions.appendToNote(), 'Failed to append text to note');
        });

        // Keep the old insertButton for backward compatibility (set to hidden)
        /**
         * @deprecated Use insertAtCursorButton instead. This is kept for backward compatibility and refers to the same element.
         */
        this.insertButton = this.insertAtCursorButton;

        // Cancel button (hidden initially, replaces entire first row when recording)
        this.cancelButton = this.container.createEl('button', {
            text: this.i18n.t('ui.buttons.cancel'),
            cls: 'voice-input-cancel-button-full voice-input-hidden'
        });
        this.cancelButton.addEventListener('click', () => {
            this.runAction(() => this.view.actions.cancelRecording(), 'Failed to cancel recording');
        });

        // Second row - Record button container
        const recordButtonContainer = this.container.createDiv('voice-input-record-container');

        // Record button
        this.recordButton = recordButtonContainer.createEl('button', {
            text: this.i18n.t('ui.buttons.recordStart'),
            cls: 'voice-input-record-button'
        });

        // Add both click and push-to-talk functionality
        this.setupRecordButtonHandlers();

        // Legacy buttons (hidden)
        this.formatButton = document.createElement('button');
        this.formatButton.classList.add('voice-input-hidden');

        this.contextCorrectionButton = document.createElement('button');
        this.contextCorrectionButton.classList.add('voice-input-hidden');

        this.cleanupButton = document.createElement('button');
        this.cleanupButton.classList.add('voice-input-hidden');
    }

    /**
	 * Create settings panel with quick controls
	 */
    private createSettingsPanel() {
        // Transcription model dropdown
        new Setting(this.settingsContainer)
            .setName(this.i18n.t('ui.settings.transcriptionModel'))
            .setClass('voice-input-inline-setting')
            .addDropdown(dropdown => {
                this.transcriptionModelDropdown = dropdown;
                dropdown
                    .addOption('gpt-4o-transcribe', this.i18n.t('ui.options.modelFull'))
                    .addOption('gpt-4o-mini-transcribe', this.i18n.t('ui.options.modelMini'))
                    .setValue(this.plugin.settings.transcriptionModel)
                    .onChange((value) => {
                        this.plugin.settings.transcriptionModel = value as 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe';
                        void this.plugin.saveSettings()
                            .then(() => {
                                this.view.actions.updateTranscriptionService();
                            })
                            .catch((error) => {
                                console.error('Failed to update transcription model', error);
                            });
                    });
            });

        // AI Post-processing section
        new Setting(this.settingsContainer)
            .setName(this.i18n.t('ui.settings.aiPostProcessing'))
            .setClass('voice-input-inline-setting')
            .addToggle(toggle => {
                this.correctionToggle = toggle;
                toggle
                    .setValue(this.plugin.settings.enableTranscriptionCorrection)
                    .onChange((value) => {
                        this.plugin.settings.enableTranscriptionCorrection = value;
                        void this.plugin.saveSettings()
                            .then(() => {
                                this.view.actions.updateTranscriptionService();
                            })
                            .catch((error) => {
                                console.error('Failed to toggle transcription correction', error);
                            });
                    });
            });
    }

    /**
	 * Setup record button event handlers for both click and push-to-talk
	 */
    private setupRecordButtonHandlers() {
        let longPressTimer: NodeJS.Timeout | null = null;
        let isPushToTalk = false;
        // let pressStartTime = 0;

        // Create event handlers
        this.clickHandler = (_e) => {
            // If this was part of a push-to-talk gesture, ignore it
            if (isPushToTalk || longPressTimer) {
                // Don't reset isPushToTalk here - let the timeout handle it
                return;
            }

            this.runAction(() => this.view.actions.toggleRecording(), 'Failed to toggle recording');
        };

        // Push-to-talk functionality with delayed start
        const startLongPress = () => {
            // pressStartTime = Date.now();

            // Start a timer to begin recording after threshold
            longPressTimer = setTimeout(() => {
                isPushToTalk = true;
                longPressTimer = null;

                if (!this.view.actions.audioRecorder || !this.view.actions.audioRecorder.isActive()) {
                    this.recordButton.setText(this.i18n.t('ui.buttons.recordPushToTalk'));
                    this.view.actions.recordingState.isPushToTalkMode = true;
                    this.view.actions.startRecording().catch((error) => {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        new Notice(this.i18n.t('error.audio.recordingFailed') + ': ' + errorMessage);
                    });
                }
            }, UI_CONSTANTS.PUSH_TO_TALK_THRESHOLD);
        };

        const endLongPress = () => {
            // const pressDuration = Date.now() - pressStartTime;

            // Cancel timer if still running (short press)
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                return;
            }

            // If push-to-talk was active, stop recording
            if (isPushToTalk && this.view.actions.audioRecorder && this.view.actions.audioRecorder.isActive()) {
                this.view.actions.recordingState.isPushToTalkMode = false;
                void this.view.actions.stopRecording().catch((error) => {
                    console.error('Failed to stop recording after push-to-talk', error);
                });
                // Keep isPushToTalk true to prevent click handler
                setTimeout(() => { isPushToTalk = false; }, UI_CONSTANTS.PUSH_TO_TALK_RESET_DELAY);
            }
        };

        // Create mouse/touch event handlers
        this.mouseDownHandler = (e) => {
            e.preventDefault();
            startLongPress();
        };

        this.mouseUpHandler = () => {
            endLongPress();
        };

        this.mouseLeaveHandler = () => {
            endLongPress();
        };

        this.touchStartHandler = (e) => {
            e.preventDefault();
            startLongPress();
        };

        this.touchEndHandler = (e) => {
            e.preventDefault();
            endLongPress();
        };

        // Add event listeners
        this.recordButton.addEventListener('click', this.clickHandler);
        this.recordButton.addEventListener('mousedown', this.mouseDownHandler);
        this.recordButton.addEventListener('mouseup', this.mouseUpHandler);
        this.recordButton.addEventListener('mouseleave', this.mouseLeaveHandler);
        this.recordButton.addEventListener('touchstart', this.touchStartHandler);
        this.recordButton.addEventListener('touchend', this.touchEndHandler);
    }

    /**
	 * Enable/disable action buttons
	 */
    setButtonsEnabled(enabled: boolean) {
        this.cleanupButton.disabled = !enabled;
        this.clipboardButton.disabled = !enabled;
        this.insertButton.disabled = !enabled;
        this.insertAtCursorButton.disabled = !enabled;
        this.appendButton.disabled = !enabled;
        this.clearButton.disabled = !enabled;
    }

    /**
	 * Show/hide cancel button during recording
	 */
    showCancelButton(show: boolean) {
        if (show) {
            // Ensure cancel button uses the current locale
            this.cancelButton?.setText(this.i18n.t('ui.buttons.cancel'));
            // Hide button rows
            this.firstRowContainer.classList.add('voice-input-hidden');
            this.firstRowContainer.classList.remove('voice-input-flex');
            this.secondRowContainer.classList.add('voice-input-hidden');
            this.secondRowContainer.classList.remove('voice-input-flex');
            // Show cancel button with flex for centering
            this.cancelButton.classList.remove('voice-input-hidden');
            this.cancelButton.classList.add('voice-input-flex');
        } else {
            // Show button rows
            this.firstRowContainer.classList.remove('voice-input-hidden');
            this.firstRowContainer.classList.add('voice-input-flex');
            this.secondRowContainer.classList.remove('voice-input-hidden');
            this.secondRowContainer.classList.add('voice-input-flex');
            // Hide cancel button
            this.cancelButton.classList.add('voice-input-hidden');
            this.cancelButton.classList.remove('voice-input-flex');
        }
    }

    /**
	 * Update settings UI components to reflect current settings
	 */
    updateSettingsUI() {
        // Update correction toggle
        const correctionToggle = this.correctionToggle;
        if (correctionToggle) {
            correctionToggle.setValue(this.plugin.settings.enableTranscriptionCorrection);
        }

        // Update transcription model dropdown
        const transcriptionModelDropdown = this.transcriptionModelDropdown;
        if (transcriptionModelDropdown) {
            transcriptionModelDropdown.setValue(this.plugin.settings.transcriptionModel);
        }

        // (no additional post-processing UI elements to update)
    }

    /**
	 * Setup text change listener for auto-save
	 */
    private setupTextChangeListener() {
        if (!this.textArea) return;

        // Create the text change handler
        this.textChangeHandler = () => {
            // Trigger auto-save through the view
            this.view.onTextChanged();
        };

        // Listen to multiple events that indicate text changes
        this.textArea.addEventListener('input', this.textChangeHandler);
        this.textArea.addEventListener('paste', this.textChangeHandler);
        this.textArea.addEventListener('cut', this.textChangeHandler);
    }

    /**
	 * Helper to safely run async view actions without unhandled rejections
	 */
    private runAction(task: () => Promise<void>, context: string): void {
        void task().catch((error) => {
            console.error(context, error);
        });
    }

    /**
	 * Clean up resources
	 */
    destroy() {
        // Remove text change listener
        if (this.textArea && this.textChangeHandler) {
            this.textArea.removeEventListener('input', this.textChangeHandler);
            this.textArea.removeEventListener('paste', this.textChangeHandler);
            this.textArea.removeEventListener('cut', this.textChangeHandler);
        }

        // Remove event listeners
        if (this.recordButton) {
            if (this.clickHandler) {
                this.recordButton.removeEventListener('click', this.clickHandler);
            }
            if (this.mouseDownHandler) {
                this.recordButton.removeEventListener('mousedown', this.mouseDownHandler);
            }
            if (this.mouseUpHandler) {
                this.recordButton.removeEventListener('mouseup', this.mouseUpHandler);
            }
            if (this.mouseLeaveHandler) {
                this.recordButton.removeEventListener('mouseleave', this.mouseLeaveHandler);
            }
            if (this.touchStartHandler) {
                this.recordButton.removeEventListener('touchstart', this.touchStartHandler);
            }
            if (this.touchEndHandler) {
                this.recordButton.removeEventListener('touchend', this.touchEndHandler);
            }
        }

        // Clear references
        this.clickHandler = null;
        this.mouseDownHandler = null;
        this.mouseUpHandler = null;
        this.mouseLeaveHandler = null;
        this.touchStartHandler = null;
        this.touchEndHandler = null;
        this.textChangeHandler = null;
    }
}
