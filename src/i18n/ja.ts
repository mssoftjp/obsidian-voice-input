/**
 * 日本語翻訳リソース
 */
import { TranslationResource } from '../interfaces';

export const ja: TranslationResource = {
    error: {
        api: {
            noKey: 'OpenAI APIキーが設定されていません',
            invalidKey: '無効なAPIキー形式です',
            invalidKeyDetail: '無効なAPIキー形式です。sk-で始まるAPIキーを入力してください。',
            connectionFailed: 'APIへの接続に失敗しました',
            quotaExceeded: 'APIの利用上限に達しました',
            rateLimited: 'APIのレート制限に達しました。しばらく待ってから再試行してください。',
            unauthorized: 'APIキーが無効です。設定を確認してください。'
        },
        audio: {
            micPermission: 'マイクへのアクセス許可が必要です',
            micNotFound: 'マイクが見つかりません',
            micInitFailed: 'マイクの初期化に失敗しました',
            recordingFailed: '録音の開始に失敗しました',
            audioContextFailed: 'オーディオコンテキストの作成に失敗しました'
        },
        transcription: {
            failed: '文字起こしに失敗しました',
            emptyResult: '文字起こし結果が空です',
            serviceInitFailed: 'サービスの初期化に失敗しました'
        },
        file: {
            createFailed: 'ファイルの作成に失敗しました',
            notFound: 'ファイルが見つかりません',
            wasmLoadFailed: 'WebAssemblyモジュールの読み込みに失敗しました'
        },
        general: {
            unknown: '不明なエラーが発生しました',
            network: 'ネットワークエラーが発生しました',
            timeout: 'タイムアウトしました',
            fatal: 'プラグインで致命的なエラーが発生しました。再起動してください。',
            default: '処理中に問題が発生しました。'
        }
    },
    status: {
        idle: 'ステータス: 待機中',
        memoCleared: 'ステータス: メモをクリアしました',
        clipboardCopied: 'ステータス: クリップボードにコピーしました',
        noteInserted: 'ステータス: ノートに挿入しました',
        noteAppended: 'ステータス: ノートの末尾に挿入しました',
        cleanupInProgress: 'ステータス: 処理中...',
        cleanupCompleted: 'ステータス: 処理完了',
        draftRestored: 'ステータス: 前回の下書きを復元しました',
        recording: {
            preparing: 'ステータス: 録音準備中...',
            micInit: 'ステータス: マイク初期化中...',
            recording: 'ステータス: 録音中...',
            stopped: 'ステータス: 停止済み',
            cancelled: 'ステータス: キャンセルされました'
        },
        processing: {
            transcribing: 'ステータス: 文字起こし中...',
            correcting: 'ステータス: 清書中...',
            completed: 'ステータス: 完了'
        },
        transcription: {
            vadAutoStopped: 'ステータス: 無音検出により自動停止しました',
            maxDurationReached: 'ステータス: 最大録音時間に達しました',
            audioTooShort: 'ステータス: 音声が短すぎます',
            noAudioDetected: 'ステータス: 音声が検出されませんでした'
        },
        warning: {
            noTextToClear: 'ステータス: クリアするテキストがありません',
            noTextToCopy: 'ステータス: コピーするテキストがありません',
            noTextToCleanup: 'ステータス: 処理するテキストがありません',
            noTextToInsert: 'ステータス: 挿入するテキストがありません',
            clearConfirm: 'ステータス: もう一度押してクリア'
        },
        error: 'ステータス: エラー'
    },
    notification: {
        success: {
            copied: 'クリップボードにコピーしました',
            inserted: 'テキストをノートに挿入しました',
            cleared: 'メモをクリアしました',
            cleanupDone: '処理が完了しました',
            newNoteCreated: '新しいノートを作成しました',
            dictionaryExported: '辞書を正常にエクスポートしました',
            dictionaryImported: '辞書を正常にインポートしました',
            apiKeyValid: '成功: APIキーの検証に成功しました'
        },
        warning: {
            noTextToCopy: 'コピーするテキストがありません',
            noTextToInsert: '挿入するテキストがありません',
            noTextToClear: 'クリアするテキストがありません',
            noTextToCleanup: '処理するテキストがありません',
            noEditorFound: 'エディタが見つかりません。クリップボードにコピーしました。',
            enterApiKey: 'APIキーを入力してください',
            serviceInitFailed: 'サービスの初期化に失敗しました',
            audioTooShort: '音声が短すぎます',
            noAudioDetected: '音声が検出されませんでした'
        },
        error: {
            clipboardFailed: 'クリップボードへのコピーに失敗しました',
            noteCreateFailed: 'ノートの作成に失敗しました。クリップボードにコピーしました。',
            apiKeyInvalid: 'エラー: APIキーの検証に失敗しました',
            testError: 'テスト中にエラーが発生しました',
            cleanupFailed: '処理に失敗しました: {error}',
            dictionaryParseFailed: '辞書の読み込みに失敗しました: {error}',
            dictionaryImportFailed: 'インポートに失敗しました: ',
            noDictionaryData: 'エクスポートする辞書データがありません',
            dictionaryExportFailed: '辞書のエクスポートに失敗しました'
        }
    },
    ui: {
        buttons: {
            recordStart: '音声入力開始',
            recordStop: '音声入力停止',
            recordPushToTalk: '話し続けてください...',
            recordStopPushToTalk: '離すと停止',
            recordPreparing: 'マイク準備中...',
            cleanup: '清書',
            copy: 'コピー',
            insert: 'ノートに挿入',
            insertAtCursor: 'カーソル位置に挿入',
            append: '末尾に挿入',
            clear: 'クリア',
            cancel: 'キャンセル',
            connectionTest: '接続テスト',
            testing: 'テスト中...',
            testSuccess: '成功',
            testFailed: '失敗',
            openSettings: '設定を開く',
            reset: 'デフォルトに戻す',
            preview: 'JSONを表示',
            export: 'エクスポート',
            import: 'インポート'
        },
        placeholders: {
            textarea: 'ここに音声の文字起こしが表示されます...',
            apiKey: 'sk-...',
            language: 'ja'
        },
        titles: {
            main: 'Voice Input',
            settings: 'Voice Input 設定',
            visualizer: '音声レベル'
        },
        settings: {
            apiKey: 'OpenAI API キー',
            apiKeyDesc: '文字起こし用のOpenAI APIキー',
            aiPostProcessing: '辞書補正',
            aiPostProcessingDesc: '文字起こし結果を辞書で補正',
            transcriptionCorrection: '文字起こし補正',
            transcriptionCorrectionDesc: '辞書補正を適用して、より正確なテキストを生成',
            transcriptionModel: '文字起こしモデル',
            transcriptionModelDesc: '音声認識に使用するモデルを選択',
            maxRecordingDuration: '最大録音時間',
            maxRecordingDurationDesc: '最大録音時間（秒）（{min}秒〜{max}分）',
            pluginLanguage: 'プラグイン言語',
            pluginLanguageDesc: 'UI表示、音声認識処理、補正辞書の言語を設定',
            customDictionary: 'カスタム辞書',
            customDictionaryDesc: '補正辞書を管理',
            dictionaryDefinite: '固定補正（最大{max}個）',
            dictionaryContextual: '文脈補正（最大{max}個）',
            dictionaryImportExport: '辞書のインポート/エクスポート',
            dictionaryImportExportDesc: '補正辞書をJSONファイルとしてインポート・エクスポート'
        },
        options: {
            modelMini: 'GPT-4o mini Transcribe',
            modelFull: 'GPT-4o Transcribe'
        },
        tooltips: {
            copy: 'クリップボードにコピー',
            insert: 'カーソル位置に挿入',
            insertAtCursor: 'カーソル位置に挿入',
            append: 'ノートの末尾に挿入',
            clear: '2回押してテキストエリアをクリア',
            settingsButton: '設定画面を開く'
        },
        units: {
            seconds: '秒',
            minutes: '分'
        },
        labels: {
            from: '入力語',
            fromMultiple: '入力語（カンマ区切り）',
            to: '修正語',
            context: '文脈キーワード'
        },
    }
};
