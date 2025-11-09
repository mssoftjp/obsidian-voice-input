import {
    Plugin
} from 'obsidian';
import { VoiceInputSettings, DEFAULT_SETTINGS } from '../interfaces';
import { VoiceInputView, VIEW_TYPE_VOICE_INPUT } from '../views';
import { VoiceInputSettingTab } from '../settings';
import { ViewManager, DraftManager } from '../managers';
import { ErrorHandler } from '../errors';
import { Logger, getLogger, mergeSettings, hasSettingsKey, migrateCorrectionEntries, DeferredViewHelper } from '../utils';
import { serviceLocator, ServiceKeys, getI18nService } from '../services';
import { getObsidianLocale } from '../types';
import { SafeStorageService } from '../security';

type LegacyVoiceInputSettings = Partial<VoiceInputSettings> & {
    language?: string;
    interfaceLanguage?: string;
    recordingMode?: string;
    autoStopSilenceDuration?: number;
    minSpeechDuration?: number;
};

export default class VoiceInputPlugin extends Plugin {
    settings: VoiceInputSettings;
    private viewManager: ViewManager;
    private errorHandler: ErrorHandler;
    private logger: Logger;

    onload(): void {
        void this.initializePlugin().catch((error) => {
            if (typeof console !== 'undefined' && console.error) {
                console.error('Voice Input Plugin failed to load', error);
            }
        });
    }

    private async initializePlugin(): Promise<void> {
        // 初期化順序の依存関係:
        // 1. ServiceLocatorに基本サービスを登録
        // 2. ErrorHandlerとLoggerの初期化
        // 3. Settingsの読み込み
        // 4. ViewManagerの初期化
        // 5. ViewとCommandの登録

        // Step 1: Register basic services
        // In Obsidian, we determine development mode based on the presence of a .git folder
        const isDevelopment = await this.app.vault.adapter.exists('.git');
        serviceLocator.register(ServiceKeys.IS_DEVELOPMENT, isDevelopment);

        // Step 2: Load settings first to get debug mode configuration
        await this.loadSettings();

        // Step 3: Initialize error handling and logging with debug mode from settings
        this.errorHandler = ErrorHandler.getInstance({ isDevelopment });
        serviceLocator.register(ServiceKeys.ERROR_HANDLER, this.errorHandler);

        this.logger = Logger.getInstance({
            debugMode: this.settings.debugMode || isDevelopment,
            logLevel: this.settings.logLevel
        });
        serviceLocator.register(ServiceKeys.LOGGER_FACTORY, (component: string) => getLogger(component));

        this.logger.info('Voice Input Plugin loading...', {
            debugMode: this.settings.debugMode,
            isDevelopment,
            logLevel: this.settings.logLevel
        });

        // Initialize DraftManager logger
        DraftManager.initLogger();
        this.logger.debug('DraftManager logger initialized');

        try {
            // Step 4: Initialize i18n with user's preferred language
            const i18nService = getI18nService();
            i18nService.setLocale(this.settings.pluginLanguage);
            serviceLocator.register(ServiceKeys.I18N_SERVICE, i18nService);
            this.logger.debug('I18n service initialized', { locale: this.settings.pluginLanguage });

            // Step 5: Initialize ViewManager (requires app instance only)
            this.viewManager = new ViewManager(this.app);
            this.logger.debug('ViewManager initialized');

            // Initialize UI when workspace layout is ready
            this.app.workspace.onLayoutReady(() => {
                this.initializeUI();
            });

            this.logger.info('Voice Input Plugin loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load Voice Input Plugin', error);
            this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                {
                    component: 'VoiceInputPlugin',
                    operation: 'onload',
                    timestamp: new Date()
                }
            );
        }
    }

    /**
     * Initialize UI components when workspace layout is ready
     */
    private initializeUI(): void {
        try {
            this.logger.debug('Initializing UI components...');

            const i18n = getI18nService();

            // Register the view
            this.registerView(
                VIEW_TYPE_VOICE_INPUT,
                (leaf) => new VoiceInputView(leaf, this)
            );
            this.logger.debug('VoiceInputView registered');

            // Add ribbon icon
            this.addRibbonIcon('microphone', i18n.t('ui.titles.main'), () => {
                this.logger.debug('Ribbon icon clicked');
                void this.viewManager.activateVoiceInputView();
            });
            this.logger.debug('Ribbon icon added');

            // Add command
            this.addCommand({
                id: 'open-view',
                name: i18n.t('ui.commands.openView'),
                callback: () => {
                    this.logger.debug('Command executed: open-view');
                    void this.viewManager.activateVoiceInputView();
                }
            });
            this.logger.debug('Commands registered');

            // Add settings tab
            this.addSettingTab(new VoiceInputSettingTab(this.app, this));
            this.logger.debug('Settings tab added');

            this.logger.info('UI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize UI', error);
            this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                {
                    component: 'VoiceInputPlugin',
                    operation: 'initializeUI',
                    timestamp: new Date()
                }
            );
            throw error;
        }
    }

    onunload(): void {
        void this.teardownPlugin();
    }

    private async teardownPlugin(): Promise<void> {
        // Logger might not be initialized if onload failed
        if (this.logger) {
            this.logger.info('Voice Input Plugin unloading...');
        }

        try {
            // Save draft text from any open Voice Input views
            if (this.viewManager) {
                const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_VOICE_INPUT);
                for (const leaf of leaves) {
                    const view = await DeferredViewHelper.safeGetVoiceInputView(leaf);
                    if (view?.ui?.textArea?.value) {
                        await DraftManager.saveDraft(this.app, view.ui.textArea.value, 'plugin-unload');
                    }
                }

                // Stop any active recordings before cleanup
                const stopPromises = leaves.map(async leaf => {
                    const view = await DeferredViewHelper.safeGetVoiceInputView(leaf);
                    if (view?.actions?.audioRecorder?.isActive()) {
                        this.logger?.info('Stopping active recording before unload');
                        // Add timeout to prevent hanging
                        return Promise.race([
                            view.actions.stopRecording(),
                            new Promise(resolve => setTimeout(resolve, 1000)) // 1 second timeout
                        ]).catch(error => {
                            this.logger.error('Error stopping recording during unload', error);
                        });
                    }
                    return Promise.resolve();
                });

                // Wait for all recordings to stop
                await Promise.all(stopPromises);

                this.viewManager.cleanupVoiceInputViews();
                this.viewManager.dispose();
                this.logger?.debug('ViewManager cleaned up');
            }
            if (this.errorHandler) {
                this.errorHandler.dispose();
                this.logger?.debug('ErrorHandler cleaned up');
            }

            // ServiceLocatorをクリア
            serviceLocator.clear();
            this.logger?.debug('ServiceLocator cleared');

            this.logger?.info('Voice Input Plugin unloaded successfully');
        } catch (error) {
            if (this.logger) {
                this.logger.error('Error during plugin unload', error);
            } else {
                // Fallback: Only use console if it exists (for extreme edge cases)
                // This should rarely happen as logger is initialized early
                if (typeof console !== 'undefined' && console.error) {
                    console.error('Error during plugin unload', error);
                }
            }
        }
    }

    async loadSettings() {
        const data = this.parseStoredSettings(await this.loadData());

        // まずデフォルト設定から開始
        this.settings = { ...DEFAULT_SETTINGS };

        // 保存が必要かどうかを追跡
        let needsSave = false;

        if (data) {
            // 設定のマイグレーション処理
            const migratedData = { ...data };

            // interfaceLanguageからpluginLanguageへの移行
            if ('interfaceLanguage' in data && !('pluginLanguage' in data)) {
                migratedData.pluginLanguage = data.interfaceLanguage;
                delete migratedData.interfaceLanguage;
                needsSave = true;
                this.logger?.info('Migrating interfaceLanguage to pluginLanguage');
            }

            // languageからtranscriptionLanguageへの移行（autoは検出ロケールへ変換）
            if ('language' in data && !('transcriptionLanguage' in data)) {
                // 既存のlanguageフィールドをtranscriptionLanguageに移行
                const langValue = data.language;
                if (langValue === 'ja' || langValue === 'en' || langValue === 'zh' || langValue === 'ko') {
                    migratedData.transcriptionLanguage = langValue;
                } else if (langValue === 'auto') {
                    // auto は廃止: 起動環境のロケールへ固定
                    migratedData.transcriptionLanguage = this.detectPluginLanguage();
                } else {
                    migratedData.transcriptionLanguage = this.detectPluginLanguage();
                }
                delete migratedData.language;
                needsSave = true;
                this.logger?.info(`Migrating language (${data.language}) to transcriptionLanguage (${migratedData.transcriptionLanguage})`);
            }

            // languageからpluginLanguageへの移行（古いバージョンとの互換性のため）
            if ('language' in data && !('pluginLanguage' in data)) {
                // 言語コードを正規化（ja → ja、en → en、zh → zh、ko → ko、その他 → en）
                const langCode = data.language as string;
                if (langCode === 'ja' || langCode === 'en' || langCode === 'zh' || langCode === 'ko') {
                    migratedData.pluginLanguage = langCode;
                } else {
                    migratedData.pluginLanguage = 'en';
                }
                needsSave = true;
                this.logger?.info(`Migrating language (${data.language}) to pluginLanguage (${migratedData.pluginLanguage})`);
            }

            // 不要になったlanguageフィールドの削除
            if ('language' in data) {
                delete migratedData.language;
                needsSave = true;
                this.logger?.info('Removing redundant language field');
            }

            // VAD関連設定の削除（連続録音のみサポートするため）
            if ('recordingMode' in data || 'autoStopSilenceDuration' in data || 'minSpeechDuration' in data) {
                if ('recordingMode' in data) {
                    delete migratedData.recordingMode;
                    this.logger?.info(`Removing recordingMode setting (was: ${data.recordingMode})`);
                }
                if ('autoStopSilenceDuration' in data) {
                    delete migratedData.autoStopSilenceDuration;
                    this.logger?.info(`Removing autoStopSilenceDuration setting (was: ${data.autoStopSilenceDuration})`);
                }
                if ('minSpeechDuration' in data) {
                    delete migratedData.minSpeechDuration;
                    this.logger?.info(`Removing minSpeechDuration setting (was: ${data.minSpeechDuration})`);
                }
                needsSave = true;
                this.logger?.info('Migrated to continuous recording only mode');
            }

            // 保存されたデータをデフォルト設定に上書き（undefinedの値は除外）
            mergeSettings(this.settings, migratedData);

            // APIキーの復号化
            if (this.settings.openaiApiKey) {
                try {
                    this.settings.openaiApiKey = SafeStorageService.decryptFromStore(this.settings.openaiApiKey);
                } catch (error) {
                    this.logger?.error('Failed to decrypt API key:', error);
                    // 復号化に失敗した場合は、暗号化されていない可能性があるのでそのまま使用
                }
            }

            // customDictionaryが存在しない場合はデフォルトを使用
            if (!this.settings.customDictionary) {
                this.settings.customDictionary = DEFAULT_SETTINGS.customDictionary;
                needsSave = true;
                this.logger?.info('Initialized customDictionary with default values');
            }

            // CorrectionEntry の旧形式から新形式への移行
            if (this.settings.customDictionary.definiteCorrections &&
                this.settings.customDictionary.definiteCorrections.length > 0) {
                const originalEntries = this.settings.customDictionary.definiteCorrections;
                const migratedEntries = migrateCorrectionEntries(originalEntries);

                // 変更があった場合のみ保存
                if (JSON.stringify(originalEntries) !== JSON.stringify(migratedEntries)) {
                    this.settings.customDictionary.definiteCorrections = migratedEntries;
                    needsSave = true;
                    this.logger?.info('Migrated CorrectionEntry format from single pattern to multiple patterns');
                }
            }

            // 重要な設定が欠落している場合の検出
            // enableTranscriptionCorrectionが保存データに存在しない場合
            if (!hasSettingsKey(data, 'enableTranscriptionCorrection')) {
                needsSave = true;
                this.logger?.info('enableTranscriptionCorrection not found, using default: true');
            }

            // pluginLanguageが設定されていない場合
            if (!hasSettingsKey(data, 'pluginLanguage') &&
                !hasSettingsKey(data, 'interfaceLanguage')) {
                this.settings.pluginLanguage = this.detectPluginLanguage();
                needsSave = true;
                this.logger?.info(`Auto-detected language: ${this.settings.pluginLanguage} (from Obsidian: ${getObsidianLocale(this.app)})`);
            }

            // 高度設定のマイグレーション（auto を廃止）
            if (!hasSettingsKey(data, 'advanced')) {
                // 既存ユーザーには言語連動をデフォルトで有効化（現行動作維持）
                this.settings.advanced = {
                    languageLinkingEnabled: true,
                    transcriptionLanguage: this.detectPluginLanguage()
                };
                needsSave = true;
                this.logger?.info('Initialized advanced settings with language linking enabled for backward compatibility');
            } else if (data.advanced && !hasSettingsKey(data.advanced, 'languageLinkingEnabled')) {
                // advancedオブジェクトは存在するが、languageLinkingEnabledが無い場合
                this.settings.advanced.languageLinkingEnabled = true;
                needsSave = true;
                this.logger?.info('Added languageLinkingEnabled to existing advanced settings');
            } else if (data.advanced) {
                // auto からの置換
                const adv = data.advanced as { transcriptionLanguage?: string };
                if (adv.transcriptionLanguage === 'auto') {
                    this.settings.advanced.transcriptionLanguage = this.detectPluginLanguage();
                    needsSave = true;
                    this.logger?.info('Migrated advanced.transcriptionLanguage from auto to detected locale');
                }
            }

            if (!hasSettingsKey(data, 'vadMode')) {
                this.settings.vadMode = 'disabled';
                needsSave = true;
                this.logger?.info('Initialized vadMode to disabled (default)');
            }
        } else {
            // 保存データが存在しない場合（初回起動）
            this.settings.pluginLanguage = this.detectPluginLanguage();
            this.settings.transcriptionLanguage = this.detectPluginLanguage();
            this.settings.advanced = {
                languageLinkingEnabled: true,
                transcriptionLanguage: this.detectPluginLanguage()
            };
            this.settings.vadMode = 'disabled';
            needsSave = true;
            this.logger?.info(`First run - detected locale: ${this.settings.pluginLanguage}, transcriptionLanguage set to detected locale, advanced settings initialized`);
        }

        // 必要に応じて設定を保存
        if (needsSave) {
            await this.saveSettings();
            this.logger?.info('Settings saved after migration/initialization');
        }

        // i18nの言語設定は、サービスが登録された後にonload内で行う

        this.logger?.info('Settings loaded:', {
            pluginLanguage: this.settings.pluginLanguage,
            enableTranscriptionCorrection: this.settings.enableTranscriptionCorrection,
            hasApiKey: !!this.settings.openaiApiKey
        });
    }

    /**
     * Plugin language auto detection (ja/zh/ko/en)
     */
    private detectPluginLanguage(): 'ja' | 'zh' | 'ko' | 'en' {
        const obsidianLocale = getObsidianLocale(this.app).toLowerCase();
        if (obsidianLocale.startsWith('ja')) {
            return 'ja';
        } else if (obsidianLocale.startsWith('zh')) {
            return 'zh';
        } else if (obsidianLocale.startsWith('ko')) {
            return 'ko';
        } else {
            return 'en';
        }
    }

    /**
     * 解決済み言語を取得（高度設定の連動設定に基づく）
     * auto は廃止済みのため、常に具体的な言語コードを返す
     */
    getResolvedLanguage(): 'ja' | 'zh' | 'ko' | 'en' {
        // 言語連動が無効な場合: advanced.transcriptionLanguage を優先
        if (this.settings.advanced?.languageLinkingEnabled === false) {
            const advancedLang = this.settings.advanced?.transcriptionLanguage;
            return advancedLang ?? this.detectPluginLanguage();
        }
        // 言語連動が有効: 通常の transcriptionLanguage を使用
        const baseLang = this.settings.transcriptionLanguage;
        return baseLang ?? this.detectPluginLanguage();
    }

    async saveSettings() {
        // APIキーを暗号化して保存
        const dataToSave = {
            ...this.settings,
            openaiApiKey: this.settings.openaiApiKey ? SafeStorageService.encryptForStore(this.settings.openaiApiKey) : ''
        };
        await this.saveData(dataToSave);

        // Broadcast settings-changed event for open views to react immediately (UI + services)
        if (typeof this.app.workspace.trigger === 'function') {
            this.app.workspace.trigger('voice-input:settings-changed', { settings: this.settings });
        }

        // Update logger configuration based on new settings
        Logger.getInstance().updateConfig({
            debugMode: this.settings.debugMode,
            logLevel: this.settings.logLevel
        });

        // Update all open voice input views
        const updatePromises = this.app.workspace.getLeavesOfType(VIEW_TYPE_VOICE_INPUT).map(async leaf => {
            const view = await DeferredViewHelper.safeGetVoiceInputView(leaf);
            if (view) {
                // actions.updateTranscriptionServiceを呼び出す
                if (view.actions?.updateTranscriptionService) {
                    view.actions.updateTranscriptionService();
                }
                // UIコンポーネントも更新して同期を保つ
                if (view.ui) {
                    view.ui.updateSettingsUI();
                }
            }
        });

        // Wait for all updates to complete
        await Promise.all(updatePromises);
    }

    /**
	 * ViewManagerのゲッター（他のコンポーネントからアクセス可能）
	 */
    getViewManager(): ViewManager {
        return this.viewManager;
    }

    /**
	 * Get logger instance
	 */
    getLogger(): Logger | null {
        return this.logger;
    }

    private parseStoredSettings(data: unknown): LegacyVoiceInputSettings | null {
        if (typeof data === 'object' && data !== null) {
            return data as LegacyVoiceInputSettings;
        }
        return null;
    }
}
