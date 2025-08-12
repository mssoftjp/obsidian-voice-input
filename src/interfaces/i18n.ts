/**
 * 国際化（i18n）関連のインターフェース定義
 *
 * CLAUDE.md の哲学に従った実装:
 * - 型安全性: すべての翻訳キーを型で定義
 * - 拡張性: 新しい言語の追加が容易
 * - 一貫性: プラグイン全体で統一されたi18n使用
 */

/**
 * サポートする言語コード
 */
export const SUPPORTED_LOCALES = ['ja', 'en', 'zh', 'ko'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

/**
 * デフォルト言語
 */
export const DEFAULT_LOCALE: Locale = 'ja';

/**
 * 翻訳リソースの型定義
 * ネストされたオブジェクト構造をサポート
 */
export type TranslationResource = {
  error: {
    api: {
      noKey: string;
      invalidKey: string;
      invalidKeyDetail: string;
      connectionFailed: string;
      quotaExceeded: string;
      rateLimited: string;
      unauthorized: string;
    };
    audio: {
      micPermission: string;
      micNotFound: string;
      micInitFailed: string;
      recordingFailed: string;
      audioContextFailed: string;
    };
    transcription: {
      failed: string;
      emptyResult: string;
      serviceInitFailed: string;
    };
    file: {
      createFailed: string;
      notFound: string;
      wasmLoadFailed: string;
    };
    general: {
      unknown: string;
      network: string;
      timeout: string;
      error: string;
      warning: string;
      fatal: string;
      default: string;
    };
  };
  status: {
    idle: string;
    memoCleared: string;
    clipboardCopied: string;
    noteInserted: string;
    noteAppended: string;
    cleanupInProgress: string;
    cleanupCompleted: string;
    draftRestored: string;
    recording: {
      preparing: string;
      micInit: string;
      recording: string;
      stopped: string;
      cancelled: string;
    };
    processing: {
      transcribing: string;
      correcting: string;
      completed: string;
      waiting: string;
    };
    transcription: {
      vadAutoStopped: string;
      maxDurationReached: string;
      audioTooShort: string;
      noAudioDetected: string;
    };
    warning: {
      noTextToClear: string;
      noTextToCopy: string;
      noTextToCleanup: string;
      noTextToInsert: string;
      clearConfirm: string;
    };
    error: string;
  };
  notification: {
    success: {
      copied: string;
      inserted: string;
      cleared: string;
      cleanupDone: string;
      newNoteCreated: string;
      apiKeyValid: string;
      dictionaryExported: string;
      dictionaryImported: string;
    };
    warning: {
      noTextToCopy: string;
      noTextToInsert: string;
      noTextToClear: string;
      noTextToCleanup: string;
      noEditorFound: string;
      enterApiKey: string;
      serviceInitFailed: string;
      audioTooShort: string;
      noAudioDetected: string;
    };
    error: {
      clipboardFailed: string;
      noteCreateFailed: string;
      apiKeyInvalid: string;
      testError: string;
      cleanupFailed: string;
      dictionaryParseFailed: string;
      dictionaryImportFailed: string;
      noDictionaryData: string;
      dictionaryExportFailed: string;
    };
  };
  ui: {
    buttons: {
      recordStart: string;
      recordStop: string;
      recordPushToTalk: string;
      recordStopPushToTalk: string;
      recordPreparing: string;
      cleanup: string;
      copy: string;
      insert: string;
      insertAtCursor: string;
      append: string;
      clear: string;
      cancel: string;
      connectionTest: string;
      testing: string;
      testSuccess: string;
      testFailed: string;
      reset: string;
      export: string;
      import: string;
    };
    placeholders: {
      textarea: string;
      apiKey: string;
      language: string;
    };
    titles: {
      main: string;
      settings: string;
    };
    settings: {
      apiKey: string;
      apiKeyDesc: string;
      aiPostProcessing: string;
      aiPostProcessingDesc: string;
      transcriptionCorrection: string;
      transcriptionCorrectionDesc: string;
      transcriptionModel: string;
      transcriptionModelDesc: string;
      maxRecordingDuration: string;
      maxRecordingDurationDesc: string;
      language: string;
      languageDesc: string;
      transcriptionLanguage: string;
      transcriptionLanguageDesc: string;
      pluginLanguage: string;
      pluginLanguageDesc: string;
      customDictionary: string;
      customDictionaryDesc: string;
      dictionaryDefinite: string;
      dictionaryImportExport: string;
      dictionaryImportExportDesc: string;
    };
    options: {
      modelMini: string;
      modelFull: string;
      languageAuto: string;
      languageJa: string;
      languageEn: string;
      languageZh: string;
      languageKo: string;
    };
    tooltips: {
      copy: string;
      insert: string;
      insertAtCursor: string;
      append: string;
      clear: string;
      settingsButton: string;
    };
    units: {
      seconds: string;
      minutes: string;
    };
    labels: {
      from: string;
      fromMultiple: string;
      to: string;      context: string;
    };
  };
};

/**
 * 翻訳キーのパス型
 * ドット記法でネストされたキーにアクセス
 */
export type TranslationKey = string;

/**
 * i18nサービスのインターフェース
 */
export interface I18nService {
  /**
   * 現在の言語を取得
   */
  getCurrentLocale(): Locale;

  /**
   * 言語を設定
   * @param locale 設定する言語コード
   */
  setLocale(locale: Locale): void;

  /**
   * 翻訳を取得
   * @param key 翻訳キー（ドット記法）
   * @param params パラメータ置換用のオブジェクト
   */
  t(key: TranslationKey, params?: Record<string, string | number>): string;

  /**
   * 利用可能な言語のリストを取得
   */
  getAvailableLocales(): readonly Locale[];

  /**
   * 言語変更時のコールバックを登録
   */
  onLocaleChange(callback: (locale: Locale) => void): void;

  /**
   * 言語変更時のコールバックを解除
   */
  offLocaleChange(callback: (locale: Locale) => void): void;
}

/**
 * 翻訳関数の型
 */
export type TranslateFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
