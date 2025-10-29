import { Locale } from './i18n';
import { SimpleCorrectionDictionary } from './transcription';
import { LogLevel } from '../utils';

export interface VoiceInputSettings {
    openaiApiKey: string;
    enableTranscriptionCorrection: boolean; // 文字起こし補正を有効化（辞書補正）
    transcriptionModel: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe';
    vadMode: 'server' | 'local' | 'disabled';
    // 録音設定
    maxRecordingSeconds: number; // 最大録音時間（秒）
    // 言語設定
    transcriptionLanguage: 'ja' | 'en' | 'zh' | 'ko'; // 音声認識言語
    pluginLanguage: Locale; // プラグインUI表示の言語
    customDictionary: SimpleCorrectionDictionary;
    // デバッグ設定
    debugMode: boolean; // デバッグモード
    logLevel: LogLevel; // ログレベル
    // 高度設定
    advanced: {
        languageLinkingEnabled: boolean; // UI言語と認識言語を連動する（デフォルト: true）
        transcriptionLanguage?: 'ja' | 'en' | 'zh' | 'ko'; // 独立した音声認識言語設定
    };
}

export const DEFAULT_SETTINGS: VoiceInputSettings = {
    openaiApiKey: '',
    enableTranscriptionCorrection: true,  // デフォルトで補正を有効化
    transcriptionModel: 'gpt-4o-transcribe',
    // 録音設定
    maxRecordingSeconds: 300, // 5分（300秒）
    // 言語設定
    transcriptionLanguage: 'en', // 初期値（実際は起動時に環境ロケールへ移行）
    pluginLanguage: 'en', // 初期値、実際はObsidianの設定に従う
    vadMode: 'server',
    customDictionary: { definiteCorrections: [] },
    // デバッグ設定
    debugMode: false, // 本番環境ではデフォルトでオフ
    logLevel: LogLevel.INFO, // 通常レベル
    // 高度設定
    advanced: {
        languageLinkingEnabled: true,
        transcriptionLanguage: 'en'
    }
};
