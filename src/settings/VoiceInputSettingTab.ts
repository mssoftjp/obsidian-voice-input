import {
    App,
    PluginSettingTab,
    Setting,
    Notice,
    Platform
} from 'obsidian';
import VoiceInputPlugin from '../plugin';
import { DEFAULT_SETTINGS } from '../interfaces';
import type { VoiceInputSettings } from '../interfaces';
import { DICTIONARY_CONSTANTS, UI_CONSTANTS } from '../config';
import { CorrectionEntry } from '../interfaces';
import { SecurityUtils } from '../security';
import { getI18n, createServiceLogger } from '../services';
import type { I18nService, Locale } from '../interfaces';
import { SUPPORTED_LOCALES } from '../interfaces';
import { VIEW_TYPE_VOICE_INPUT } from '../views';
import { Logger, hasLocalVadAssets, getLocalVadInstructionsPath, getLocalVadAssetPath } from '../utils';
import { patternsToString, stringToPatterns, migrateCorrectionEntries } from '../utils';
import { DeferredViewHelper } from '../utils';

type TranscriptionModelOption = VoiceInputSettings['transcriptionModel'];
type VadModeOption = VoiceInputSettings['vadMode'];

const isTranscriptionModel = (value: string): value is TranscriptionModelOption =>
    value === 'gpt-4o-transcribe' || value === 'gpt-4o-mini-transcribe';

const isVadMode = (value: string): value is VadModeOption =>
    value === 'server' || value === 'local' || value === 'disabled';

const toArrayBuffer = (view: Uint8Array): ArrayBuffer => {
    const { buffer, byteOffset, byteLength } = view;
    if (buffer instanceof ArrayBuffer) {
        return byteOffset === 0 && byteLength === buffer.byteLength
            ? buffer
            : buffer.slice(byteOffset, byteOffset + byteLength);
    }
    const clone = Uint8Array.from(view);
    return clone.buffer instanceof ArrayBuffer ? clone.buffer : new ArrayBuffer(0);
};

interface DictionaryExportData {
    version: string;
    definiteCorrections: CorrectionEntry[];
    exportedAt?: string;
}

export class VoiceInputSettingTab extends PluginSettingTab {
    plugin: VoiceInputPlugin;
    private i18n: I18nService;
    private logger: Logger;
    private blurHandler: (() => void) | null = null;
    private apiKeyInput: HTMLInputElement | null = null;

    constructor(app: App, plugin: VoiceInputPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.i18n = getI18n();
        this.logger = createServiceLogger('VoiceInputSettingTab');
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Use Obsidian's setHeading API instead of createEl('h2')
        new Setting(containerEl)
            .setHeading()
            .setName(this.i18n.t('ui.titles.settings'));

        // Plugin Language Setting
        new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.pluginLanguage'))
            .setDesc(this.i18n.t('ui.settings.pluginLanguageDesc'))
            .addDropdown(dropdown => dropdown
                .addOptions(Object.fromEntries(
                    SUPPORTED_LOCALES.map(locale => [
                        locale,
                        locale === 'ja' ? 'Japanese' :
                            locale === 'en' ? 'English' :
                                locale === 'zh' ? 'Chinese' :
                                    locale === 'ko' ? 'Korean' : locale
                    ])
                ))
                .setValue(this.plugin.settings.pluginLanguage)
                .onChange((value: Locale) => {
                    this.runAsync(async () => {
                        const transcriptionLocale: VoiceInputSettings['transcriptionLanguage'] = value;
                        this.plugin.settings.pluginLanguage = value;

                        // Keep transcription language synchronized while linking remains enabled
                        if (this.plugin.settings.advanced?.languageLinkingEnabled !== false) {
                            this.plugin.settings.transcriptionLanguage = transcriptionLocale;
                            if (!this.plugin.settings.advanced) {
                                this.plugin.settings.advanced = {
                                    languageLinkingEnabled: true,
                                    transcriptionLanguage: transcriptionLocale
                                };
                            } else {
                                this.plugin.settings.advanced.transcriptionLanguage = transcriptionLocale;
                            }
                        }

                        await this.plugin.saveSettings();
                        this.i18n.setLocale(value);

                        // Refresh all open Voice Input views to show new language
                        const refreshPromises = this.app.workspace.getLeavesOfType(VIEW_TYPE_VOICE_INPUT).map(async leaf => {
                            const view = await DeferredViewHelper.safeGetVoiceInputView(leaf);
                            if (view) {
                                view.refreshUI();
                            }
                        });
                        await Promise.all(refreshPromises);

                        // Refresh the settings tab to show new language
                        this.display();
                    }, 'Failed to update plugin language');
                }));

        // Advanced Language Settings
        new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.languageLinking'))
            .setDesc(this.i18n.t('ui.settings.languageLinkingDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.advanced?.languageLinkingEnabled !== false)
                .onChange((value) => {
                    this.runAsync(async () => {
                        // Initialize advanced object if it doesn't exist
                        if (!this.plugin.settings.advanced) {
                            this.plugin.settings.advanced = {
                                languageLinkingEnabled: value,
                                transcriptionLanguage: this.plugin.getResolvedLanguage()
                            };
                        } else {
                            this.plugin.settings.advanced.languageLinkingEnabled = value;
                        }
                        await this.plugin.saveSettings();
                        // Refresh the UI to show/hide the advanced transcription language setting
                        this.display();
                    }, 'Failed to toggle language linking');
                }));

        // Advanced Transcription Language Setting (only shown when linking is disabled)
        if (this.plugin.settings.advanced?.languageLinkingEnabled === false) {
            new Setting(containerEl)
                .setName(this.i18n.t('ui.settings.advancedTranscriptionLanguage'))
                .setDesc(this.i18n.t('ui.settings.advancedTranscriptionLanguageDesc'))
                .addDropdown(dropdown => dropdown
                    .addOption('ja', this.i18n.t('ui.options.languageJa'))
                    .addOption('en', this.i18n.t('ui.options.languageEn'))
                    .addOption('zh', this.i18n.t('ui.options.languageZh'))
                    .addOption('ko', this.i18n.t('ui.options.languageKo'))
                    .setValue(this.plugin.settings.advanced.transcriptionLanguage ?? this.plugin.getResolvedLanguage())
                    .onChange((value: 'ja' | 'en' | 'zh' | 'ko') => {
                        this.runAsync(async () => {
                            if (!this.plugin.settings.advanced) {
                                this.plugin.settings.advanced = {
                                    languageLinkingEnabled: false,
                                    transcriptionLanguage: value
                                };
                            } else {
                                this.plugin.settings.advanced.transcriptionLanguage = value;
                            }
                            await this.plugin.saveSettings();
                        }, 'Failed to update advanced transcription language');
                    }));
        }

        // OpenAI API Key
        const apiKeySetting = new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.apiKey'))
            .setDesc(this.i18n.t('ui.settings.apiKeyDesc'));

        apiKeySetting.addText(text => {
            // Retrieve stored API key (now stored in plain text internally)
            const decryptedApiKey = this.plugin.settings.openaiApiKey;

            const textComponent = text
                .setPlaceholder(this.i18n.t('ui.placeholders.apiKey'))
                .setValue(decryptedApiKey ? SecurityUtils.maskAPIKey(decryptedApiKey) : '')
                .onChange((value) => {
                    this.handleApiKeyInputChange(value, apiKeySetting);
                });

            // Store input element reference
            this.apiKeyInput = textComponent.inputEl;

            // Create blur handler to mask the API key display in the input field when focus is lost,
            // while preserving the actual stored value. This avoids exposing the key in the UI but does not modify the stored key.
            this.blurHandler = () => {
                const decryptedApiKey = this.plugin.settings.openaiApiKey;
                if (decryptedApiKey) {
                    textComponent.setValue(SecurityUtils.maskAPIKey(decryptedApiKey));
                }
            };

            // Add blur event listener only - no focus handler for security
            this.apiKeyInput.addEventListener('blur', this.blurHandler);

            return textComponent;
        })
            .addButton(button => button
                .setButtonText(this.i18n.t('ui.buttons.connectionTest'))
                .onClick(() => {
                    const decryptedApiKey = this.plugin.settings.openaiApiKey;
                    if (!decryptedApiKey) {
                        new Notice(this.i18n.t('notification.warning.enterApiKey'));
                        return;
                    }

                    this.runAsync(async () => {
                        button.setButtonText(this.i18n.t('ui.buttons.testing'));
                        button.setDisabled(true);

                        try {
                            const result = await SecurityUtils.testOpenAIAPIKey(decryptedApiKey);

                            if (result.valid) {
                                new Notice(this.i18n.t('notification.success.apiKeyValid'));
                                button.setButtonText(this.i18n.t('ui.buttons.testSuccess'));
                                button.setCta();

                                // 3秒後に元に戻す
                                setTimeout(() => {
                                    button.setButtonText(this.i18n.t('ui.buttons.connectionTest'));
                                    button.removeCta();
                                    button.setDisabled(false);
                                }, 3000);
                            } else {
                                new Notice(`${result.error || this.i18n.t('notification.error.apiKeyInvalid')}`);
                                button.setButtonText(this.i18n.t('ui.buttons.testFailed'));

                                // 3秒後に元に戻す
                                setTimeout(() => {
                                    button.setButtonText(this.i18n.t('ui.buttons.connectionTest'));
                                    button.setDisabled(false);
                                }, 3000);
                            }
                        } catch (error) {
                            new Notice(this.i18n.t('notification.error.testError'));
                            button.setButtonText(this.i18n.t('ui.buttons.connectionTest'));
                            button.setDisabled(false);
                            throw error;
                        }
                    }, 'Failed to test API key');
                }));

        // Transcription Model
        new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.transcriptionModel'))
            .setDesc(this.i18n.t('ui.settings.transcriptionModelDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('gpt-4o-transcribe', this.i18n.t('ui.options.modelFull'))
                .addOption('gpt-4o-mini-transcribe', this.i18n.t('ui.options.modelMini'))
                .setValue(this.plugin.settings.transcriptionModel)
                .onChange((value) => {
                    this.runAsync(async () => {
                        if (!isTranscriptionModel(value)) {
                            this.logger.warn(`Unknown transcription model: ${value}`);
                            return;
                        }
                        this.plugin.settings.transcriptionModel = value;
                        await this.plugin.saveSettings();
                    }, 'Failed to update transcription model in settings');
                }));

        const FVAD_DOWNLOAD_URL = 'https://github.com/echogarden-project/fvad-wasm';
        const wasmFileName = 'fvad.wasm';
        const loaderFileName = 'fvad.js';
        const vadInstructionsPath = getLocalVadInstructionsPath(this.app);
        const initialVadMode = this.plugin.settings.vadMode ?? 'disabled';
        const vadModeSetting = new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.vadMode'))
            .addDropdown(dropdown => {
                dropdown
                    .addOption('disabled', this.i18n.t('ui.options.vadDisabled'))
                    .addOption('server', this.i18n.t('ui.options.vadServer'))
                    .addOption('local', this.i18n.t('ui.options.vadLocal'))
                    .setValue(initialVadMode)
                    .onChange((value) => {
                        this.runAsync(async () => {
                            if (!isVadMode(value)) {
                                this.logger.warn(`Unknown VAD mode: ${value}`);
                                return;
                            }
                            this.plugin.settings.vadMode = value;
                            await this.plugin.saveSettings();
                            const hasLocal = await refreshVadUI(value);
                            if (value === 'local' && !hasLocal) {
                                new Notice(this.i18n.t('notification.warning.localVadMissing', { path: vadInstructionsPath }));
                            }
                        }, 'Failed to update VAD mode');
                    });
            });

        const infoEl = vadModeSetting.settingEl.querySelector('.setting-item-info');
        let helperContainer: HTMLDivElement | null = null;
        let helperNote: HTMLDivElement | null = null;
        let helperButton: HTMLButtonElement | null = null;

        if (infoEl instanceof HTMLElement) {
            helperContainer = infoEl.createDiv({ cls: 'voice-input-vad-helper' });
            helperNote = helperContainer.createDiv({ cls: 'setting-item-description' });
            const buttonElement = helperContainer.createEl('button', { text: this.i18n.t('ui.settings.vadModeInstallButton') });

            if (buttonElement instanceof HTMLButtonElement) {
                helperButton = buttonElement;
                helperButton.classList.add('mod-cta');
                helperContainer.classList.add('voice-input-hidden');

                helperButton.addEventListener('click', () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.wasm,.js,application/wasm';
                    input.multiple = true;
                    input.onchange = () => {
                        this.runAsync(async () => {
                            const files = input.files ? Array.from(input.files) : [];
                            const wasmFile = files.find(file => file.name === wasmFileName);
                            const jsFile = files.find(file => file.name === loaderFileName);

                            if (!wasmFile) {
                                new Notice(this.i18n.t('ui.settings.vadModeInstallInvalidName'));
                                return;
                            }

                            const wasmBytes = new Uint8Array(await wasmFile.arrayBuffer());
                            if (wasmBytes.length < 8 ||
                                wasmBytes[0] !== 0x00 ||
                                wasmBytes[1] !== 0x61 ||
                                wasmBytes[2] !== 0x73 ||
                                wasmBytes[3] !== 0x6d) {
                                new Notice(this.i18n.t('ui.settings.vadModeInstallInvalidType'));
                                return;
                            }

                            try {
                                const adapter = this.app.vault.adapter;
                                if (!(await adapter.exists(vadInstructionsPath))) {
                                    try {
                                        await adapter.mkdir(vadInstructionsPath);
                                    } catch {
                                        // Ignore errors when directory already exists or cannot be created
                                    }
                                }

                                const wasmTarget = getLocalVadAssetPath(this.app, wasmFileName);
                                await adapter.writeBinary(wasmTarget, toArrayBuffer(wasmBytes));

                                let loaderPresent = await adapter.exists(getLocalVadAssetPath(this.app, loaderFileName));
                                if (jsFile) {
                                    const loaderContent = await jsFile.text();
                                    const loaderTarget = getLocalVadAssetPath(this.app, loaderFileName);
                                    await adapter.write(loaderTarget, loaderContent);
                                    loaderPresent = true;
                                }

                                if (!loaderPresent) {
                                    new Notice(this.i18n.t('ui.settings.vadModeInstallJsMissing'));
                                } else {
                                    new Notice(this.i18n.t('ui.settings.vadModeInstallSuccess'));
                                }
                            } catch (error) {
                                console.error(error);
                                new Notice(this.i18n.t('notification.error.fileWrite'));
                                throw error;
                            }

                            const hasLocal = await hasLocalVadAssets(this.app);
                            await refreshVadUI('local');
                            if (hasLocal) {
                                new Notice(this.i18n.t('notification.success.vadInstallComplete'));
                            }
                        }, 'Failed to process VAD asset upload');
                    };
                    input.click();
                });
            }
        }

        const createVadDescription = (includeMissing: boolean, includeLocal: boolean): DocumentFragment => {
            const fragment = document.createDocumentFragment();
            fragment.appendText(this.i18n.t('ui.settings.vadModeDesc'));
            fragment.appendChild(document.createElement('br'));
            fragment.appendText(`${this.i18n.t('ui.options.vadServer')}: ${this.i18n.t('ui.settings.vadModeSummaryServer')}`);
            fragment.appendChild(document.createElement('br'));
            fragment.appendText(`${this.i18n.t('ui.options.vadLocal')}: ${this.i18n.t('ui.settings.vadModeSummaryLocal')}`);

            if (includeMissing) {
                fragment.appendChild(document.createElement('br'));
                fragment.appendChild(document.createElement('br'));
                fragment.appendText(this.i18n.t('ui.settings.vadModeLocalMissing', { path: vadInstructionsPath }));
                fragment.appendChild(document.createElement('br'));
                const link = document.createElement('a');
                link.href = FVAD_DOWNLOAD_URL;
                link.textContent = this.i18n.t('ui.settings.vadModeInstallLinkLabel');
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                fragment.appendChild(link);
            } else if (includeLocal) {
                fragment.appendChild(document.createElement('br'));
                fragment.appendChild(document.createElement('br'));
                fragment.appendText(this.i18n.t('ui.settings.vadModeLocalAvailable', { path: vadInstructionsPath }));
            }

            return fragment;
        };

        const refreshVadUI = async (mode: VadModeOption): Promise<boolean> => {
            const hasLocal = await hasLocalVadAssets(this.app);
            const includeMissing = mode === 'local' && !hasLocal;
            const includeLocal = mode === 'local' && hasLocal;
            vadModeSetting.setDesc(createVadDescription(includeMissing, includeLocal));

            if (helperContainer && helperNote && helperButton) {
                const shouldShowHelper = !Platform.isMobileApp && mode === 'local' && !hasLocal;
                helperContainer.classList.toggle('voice-input-hidden', !shouldShowHelper);
                while (helperNote.firstChild) {
                    helperNote.removeChild(helperNote.firstChild);
                }
                if (shouldShowHelper) {
                    helperNote.appendText(this.i18n.t('ui.settings.vadModeInstallDesc') + ' ');
                    helperNote.createEl('a', {
                        text: this.i18n.t('ui.settings.vadModeInstallLinkLabel'),
                        href: FVAD_DOWNLOAD_URL,
                        attr: { target: '_blank', rel: 'noopener noreferrer' }
                    });
                }
            }

            if (mode === 'disabled') {
                return true;
            }

            return mode === 'local' ? hasLocal : true;
        };

        void refreshVadUI(initialVadMode);

        // AI Post-processing (dictionary-based)
        new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.aiPostProcessing'))
            .setDesc(this.i18n.t('ui.settings.aiPostProcessingDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTranscriptionCorrection)
                .onChange((value) => {
                    this.runAsync(async () => {
                        this.plugin.settings.enableTranscriptionCorrection = value;
                        await this.plugin.saveSettings();
                    }, 'Failed to toggle AI post-processing');
                }));

        // Maximum Recording Duration
        const maxRecordingSetting = new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.maxRecordingDuration'))
            .setDesc(this.i18n.t('ui.settings.maxRecordingDurationDesc', { min: UI_CONSTANTS.RECORDING_SECONDS_MIN, max: Math.floor(UI_CONSTANTS.RECORDING_SECONDS_MAX / 60) }));

        // Add text display for current value
        const durationText = maxRecordingSetting.controlEl.createEl('span', {
            cls: 'voice-input-setting-duration-text',
            text: this.formatDuration(this.plugin.settings.maxRecordingSeconds)
        });

        maxRecordingSetting
            .addSlider(slider => slider
                .setLimits(UI_CONSTANTS.RECORDING_SECONDS_MIN, UI_CONSTANTS.RECORDING_SECONDS_MAX, UI_CONSTANTS.RECORDING_SECONDS_STEP) // 30秒〜10分、定数に基づく刻み
                .setValue(this.plugin.settings.maxRecordingSeconds)
                .setDynamicTooltip()
                .onChange((value) => {
                    this.plugin.settings.maxRecordingSeconds = value;
                    durationText.setText(this.formatDuration(value));
                    this.runAsync(async () => {
                        await this.plugin.saveSettings();
                    }, 'Failed to update max recording duration');
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(this.i18n.t('ui.buttons.reset'))
                .onClick(() => {
                    this.plugin.settings.maxRecordingSeconds = DEFAULT_SETTINGS.maxRecordingSeconds;
                    this.runAsync(async () => {
                        await this.plugin.saveSettings();
                        this.display(); // Refresh UI
                    }, 'Failed to reset max recording duration');
                }));

        // Dictionary (Unified table editor) - Show for all languages
        new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.customDictionary'))
            .setDesc(this.i18n.t('ui.settings.customDictionaryDesc'));

        // Create table container for dictionary tables
        const tableContainer = containerEl.createDiv('voice-input-dictionary-table-container');

        // Definite Corrections Section
        new Setting(tableContainer)
            .setHeading()
            .setName(this.i18n.t('ui.settings.dictionaryDefinite', { max: DICTIONARY_CONSTANTS.MAX_DEFINITE_CORRECTIONS }));
        tableContainer.createEl('div', {
            cls: 'setting-item-description',
            text: this.i18n.t('ui.help.dictionaryFromComma')
        });
        this.createCorrectionTable(
            tableContainer,
            this.plugin.settings.customDictionary.definiteCorrections,
            false
        );

        // Import/Export buttons
        new Setting(containerEl)
            .setName(this.i18n.t('ui.settings.dictionaryImportExport'))
            .setDesc(this.i18n.t('ui.settings.dictionaryImportExportDesc'))
            .addButton(button => button
                .setButtonText(this.i18n.t('ui.buttons.export'))
                .onClick(() => this.exportDictionary()))
            .addButton(button => button
                .setButtonText(this.i18n.t('ui.buttons.import'))
                .onClick(() => this.importDictionary()));

        // Debug Settings Section - Removed as per ai-transcriber pattern
        // containerEl.createEl('h3', { text: this.i18n.t('ui.titles.debugSettings') || 'Debug Settings' });

        // Debug Mode Toggle - Removed as per ai-transcriber pattern (controlled via data.json only)
        // new Setting(containerEl)
        //     .setName(this.i18n.t('ui.settings.debugMode') || 'Debug Mode')
        //     .setDesc(this.i18n.t('ui.settings.debugModeDesc') || 'Enable detailed logging for development and troubleshooting')
        //     .addToggle(toggle => toggle
        //         .setValue(this.plugin.settings.debugMode)
        //         .onChange(async (value) => {
        //             this.plugin.settings.debugMode = value;
        //             await this.plugin.saveSettings();
        //             this.logger.info('Debug mode changed', { debugMode: value });
        //         }));

        // Log Level Dropdown (only shown when debug mode is enabled) - Removed as per ai-transcriber pattern
        // if (this.plugin.settings.debugMode) {
        //     new Setting(containerEl)
        //         .setName(this.i18n.t('ui.settings.logLevel') || 'Log Level')
        //         .setDesc(this.i18n.t('ui.settings.logLevelDesc') || 'Set the minimum log level to display')
        //         .addDropdown(dropdown => dropdown
        //             .addOption('0', 'ERROR')
        //             .addOption('1', 'WARN')
        //             .addOption('2', 'INFO')
        //             .addOption('3', 'DEBUG')
        //             .addOption('4', 'TRACE')
        //             .setValue(String(this.plugin.settings.logLevel))
        //             .onChange(async (value) => {
        //                 this.plugin.settings.logLevel = parseInt(value) as LogLevel;
        //                 await this.plugin.saveSettings();
        //                 this.logger.info('Log level changed', { logLevel: this.plugin.settings.logLevel });
        //             }));
        // }

    }

    /**
	 * Utility to run async handlers without returning promises to the caller
	 */
    private runAsync(task: () => Promise<void>, context: string): void {
        void task().catch((error) => {
            this.logger.error(context, error);
        });
    }

    private handleApiKeyInputChange(value: string, apiKeySetting: Setting): void {
        if (value && !value.includes('*')) {
            if (!SecurityUtils.validateOpenAIAPIKey(value)) {
                apiKeySetting.descEl.addClass('voice-input-setting-error');
                apiKeySetting.setDesc(this.i18n.t('error.api.invalidKeyDetail'));
            } else {
                apiKeySetting.descEl.removeClass('voice-input-setting-error');
                apiKeySetting.setDesc(this.i18n.t('ui.settings.apiKeyDesc'));
                this.plugin.settings.openaiApiKey = value;
                this.runAsync(async () => {
                    await this.plugin.saveSettings();
                }, 'Failed to save API key');
            }
        }
    }

    hide() {
        // Clean up event listeners
        if (this.apiKeyInput && this.blurHandler) {
            this.apiKeyInput.removeEventListener('blur', this.blurHandler);
            this.apiKeyInput = null;
            this.blurHandler = null;
        }
    }

    /**
	 * Format duration in seconds to human-readable string
	 */
    private formatDuration(seconds: number): string {
        if (seconds < 60) {
            return `${seconds} ${this.i18n.t('ui.units.seconds')}`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (remainingSeconds === 0) {
            return `${minutes} ${this.i18n.t('ui.units.minutes')}`;
        }
        return `${minutes} ${this.i18n.t('ui.units.minutes')} ${remainingSeconds} ${this.i18n.t('ui.units.seconds')}`;
    }

    /**
	 * Format duration in milliseconds to human-readable string
	 */
    private formatDurationMs(milliseconds: number): string {
        const seconds = milliseconds / 1000;
        if (seconds < 1) {
            return `${(Math.round(seconds * 10) / 10).toFixed(1)} ${this.i18n.t('ui.units.seconds')}`;
        }
        return `${seconds.toFixed(1)} ${this.i18n.t('ui.units.seconds')}`;
    }

    /**
	 * Create correction table for dictionary entries
	 */
    private createCorrectionTable(
        container: HTMLElement,
        entries: CorrectionEntry[],
        isContextual: boolean,
        isReadOnly = false
    ): HTMLTableElement {
        const table = container.createEl('table', { cls: 'voice-input-dictionary-table' });

        // Create header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', { text: this.i18n.t('ui.labels.from') });
        headerRow.createEl('th', { text: this.i18n.t('ui.labels.to') });
        if (isContextual) {
            headerRow.createEl('th', { text: this.i18n.t('ui.labels.context') });
        }
        headerRow.createEl('th', { text: '', cls: 'voice-input-action-column' });

        // Create body
        const tbody = table.createEl('tbody');
        this.renderTableRows(tbody, entries, isContextual, isReadOnly);

        // Add new entry button (only for editable tables)
        if (!isReadOnly) {
            const addButton = container.createEl('button', {
                text: '+',
                cls: 'voice-input-dictionary-add-button'
            });
            addButton.onclick = () => {
                const newEntry = { from: [''], to: '' };
                entries.push(newEntry);
                this.renderTableRows(tbody, entries, isContextual, isReadOnly);
                this.runAsync(() => this.saveDictionary(), 'Failed to save dictionary changes');
            };
        }

        return table;
    }

    /**
	 * Render table rows
	 */
    private renderTableRows(tbody: HTMLElement, entries: CorrectionEntry[], isContextual: boolean, isReadOnly = false) {
        tbody.empty();

        entries.forEach((entry, index) => {
            const row = tbody.createEl('tr');

            // From field (multiple patterns, comma-separated)
            const fromCell = row.createEl('td');
            if (isReadOnly) {
                fromCell.textContent = patternsToString(entry.from);
            } else {
                const fromInput = fromCell.createEl('input', {
                    type: 'text',
                    value: patternsToString(entry.from),
                    placeholder: this.i18n.t('ui.labels.fromMultiple') || 'パターン1, パターン2, ...'
                });
                fromInput.onchange = () => {
                    entry.from = stringToPatterns(fromInput.value);
                    this.runAsync(() => this.saveDictionary(), 'Failed to save dictionary changes');
                };
            }

            // To field
            const toCell = row.createEl('td');
            if (isReadOnly) {
                toCell.textContent = entry.to;
            } else {
                const toInput = toCell.createEl('input', {
                    type: 'text',
                    value: entry.to,
                    placeholder: this.i18n.t('ui.labels.to')
                });
                toInput.onchange = () => {
                    entry.to = toInput.value;
                    this.runAsync(() => this.saveDictionary(), 'Failed to save dictionary changes');
                };
            }

            // Delete button
            const actionCell = row.createEl('td', { cls: 'voice-input-action-column' });
            if (!isReadOnly) {
                const deleteButton = actionCell.createEl('button', {
                    text: '×',
                    cls: 'voice-input-dictionary-delete-button'
                });
                deleteButton.onclick = () => {
                    entries.splice(index, 1);
                    this.renderTableRows(tbody, entries, isContextual, isReadOnly);
                    this.runAsync(() => this.saveDictionary(), 'Failed to save dictionary changes');
                };
            }
        });
    }

    /**
	 * Save dictionary changes
	 */
    private async saveDictionary() {
        await this.plugin.saveSettings();

        // Update all open Voice Input views
        const updatePromises = this.app.workspace.getLeavesOfType(VIEW_TYPE_VOICE_INPUT).map(async leaf => {
            const view = await DeferredViewHelper.safeGetVoiceInputView(leaf);
            if (view?.actions?.updateTranscriptionService) {
                view.actions.updateTranscriptionService();
            }
        });
        await Promise.all(updatePromises);
    }

    /**
	 * Export dictionary as JSON
	 */
    private exportDictionary() {
        try {
            // Check if dictionary has data
            const hasData = this.plugin.settings.customDictionary.definiteCorrections.length > 0;

            if (!hasData) {
                new Notice(this.i18n.t('notification.error.noDictionaryData'));
                return;
            }

            const data = {
                version: '1.0',
                definiteCorrections: this.plugin.settings.customDictionary.definiteCorrections,
                exportedAt: new Date().toISOString()
            };

            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `voice-input-dictionary-${new Date().toISOString().split('T')[0]}.json`;

            // Add link to document temporarily
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            // Note: We cannot detect if the user cancelled the save dialog
            // So we don't show a success message here
        } catch (error) {
            this.logger.error('Failed to export dictionary', error);
            new Notice(this.i18n.t('notification.error.dictionaryExportFailed'));
        }
    }

    /**
	 * Import dictionary from JSON
	 */
    private importDictionary() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            this.runAsync(async () => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                try {
                    const text = await file.text();
                    const data = this.parseDictionaryExport(text);

                    // Migrate to new format
                    const migratedEntries = migrateCorrectionEntries(data.definiteCorrections);

                    // Update settings with migrated data
                    this.plugin.settings.customDictionary = {
                        definiteCorrections: migratedEntries
                    };

                    await this.plugin.saveSettings();
                    this.display(); // Refresh UI

                    new Notice(this.i18n.t('notification.success.dictionaryImported'));
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    new Notice(this.i18n.t('notification.error.dictionaryImportFailed') + message);
                    throw error;
                }
            }, 'Failed to import dictionary');
        };

        input.click();
    }

    private parseDictionaryExport(contents: string): DictionaryExportData {
        const parsed = JSON.parse(contents) as unknown;
        if (!this.isDictionaryExportData(parsed)) {
            throw new Error('Invalid dictionary format: missing definiteCorrections');
        }
        return parsed;
    }

    private isDictionaryExportData(value: unknown): value is DictionaryExportData {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const record = value as Record<string, unknown>;
        return Array.isArray(record.definiteCorrections);
    }
}
