import { Locale } from './i18n';
import { SimpleCorrectionDictionary } from './transcription';
import { LogLevel } from '../utils';

export interface VoiceInputSettings {
    openaiApiKey: string;
    enableTranscriptionCorrection: boolean; // 文字起こし補正を有効化（辞書補正）
    transcriptionModel: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe';
    // 録音設定
    maxRecordingSeconds: number; // 最大録音時間（秒）
    // プラグイン言語設定
    pluginLanguage: Locale; // プラグイン全体の言語（UI、音声認識、補正辞書）
    customDictionary: SimpleCorrectionDictionary;
    // デバッグ設定
    debugMode: boolean; // デバッグモード
    logLevel: LogLevel; // ログレベル
}

export const DEFAULT_SETTINGS: VoiceInputSettings = {
    openaiApiKey: '',
    enableTranscriptionCorrection: true,  // デフォルトで補正を有効化
    transcriptionModel: 'gpt-4o-transcribe',
    // 録音設定
    maxRecordingSeconds: 300, // 5分（300秒）
    // プラグイン言語はObsidianの設定に従う（loadSettingsで設定）
    pluginLanguage: 'en', // 初期値、実際はObsidianの設定に従う
    customDictionary: { definiteCorrections: [] },
    // デバッグ設定
    debugMode: false, // 本番環境ではデフォルトでオフ
    logLevel: LogLevel.INFO // 通常レベル
};
