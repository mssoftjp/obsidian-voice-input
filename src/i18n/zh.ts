/**
 * Chinese translation resource
 */
import { TranslationResource } from '../interfaces';

export const zh: TranslationResource = {
    error: {
        api: {
            noKey: 'OpenAI API密钥未设置',
            invalidKey: 'API密钥格式无效',
            invalidKeyDetail: 'API密钥格式无效。请输入以sk-开头的API密钥。',
            connectionFailed: '连接API失败',
            quotaExceeded: 'API配额已达上限',
            rateLimited: 'API请求频率受限。请稍后重试。',
            unauthorized: 'API密钥无效。请检查设置。'
        },
        audio: {
            micPermission: '需要麦克风访问权限',
            micNotFound: '未找到麦克风',
            micInitFailed: '麦克风初始化失败',
            recordingFailed: '录音启动失败',
            audioContextFailed: '音频上下文创建失败'
        },
        transcription: {
            failed: '语音转文字失败',
            emptyResult: '语音转文字结果为空',
            serviceInitFailed: '服务初始化失败'
        },
        file: {
            createFailed: '文件创建失败',
            notFound: '文件未找到',
            wasmLoadFailed: 'WebAssembly模块加载失败'
        },
        general: {
            unknown: '发生未知错误',
            network: '发生网络错误',
            timeout: '请求超时',
            error: '发生错误',
            fatal: '插件发生致命错误。请重启。',
            warning: '警告',
            default: '处理过程中发生问题。'
        }
    },
    status: {
        idle: '状态：待机中',
        memoCleared: '状态：备忘录已清除',
        clipboardCopied: '状态：已复制到剪贴板',
        noteInserted: '状态：已插入到笔记',
        noteAppended: '状态：已添加到笔记末尾',
        cleanupInProgress: '状态：处理中...',
        cleanupCompleted: '状态：处理完成',
        draftRestored: '状态：已恢复上次草稿',
        recording: {
            preparing: '状态：录音准备中...',
            micInit: '状态：麦克风初始化中...',
            recording: '状态：录音中...',
            stopped: '状态：已停止',
            cancelled: '状态：已取消',
            vadSpeech: '状态：检测到语音',
            vadSilence: '状态：检测到静音'
        },
        processing: {
            transcribing: '状态：语音转文字中...',
            correcting: '状态：文本处理中...',
            completed: '状态：完成',
            waiting: '等待中'
        },
        transcription: {
            vadAutoStopped: '状态：检测到静音自动停止',
            maxDurationReached: '状态：已达最大录音时间',
            audioTooShort: '状态：音频过短',
            noAudioDetected: '状态：未检测到音频'
        },
        warning: {
            noTextToClear: '状态：没有要清除的文本',
            noTextToCopy: '状态：没有要复制的文本',
            noTextToCleanup: '状态：没有要处理的文本',
            noTextToInsert: '状态：没有要插入的文本',
            clearConfirm: '状态：再次按下以清除'
        },
        error: '状态：错误'
    },
    notification: {
        success: {
            copied: '已复制到剪贴板',
            inserted: '文本已插入到笔记',
            cleared: '备忘录已清除',
            cleanupDone: '处理完成',
            newNoteCreated: '新笔记已创建',
            dictionaryExported: '词典导出成功',
            dictionaryImported: '词典导入成功',
            apiKeyValid: '成功：API密钥验证成功'
        },
        warning: {
            noTextToCopy: '没有要复制的文本',
            noTextToInsert: '没有要插入的文本',
            noTextToClear: '没有要清除的文本',
            noTextToCleanup: '没有要处理的文本',
            noEditorFound: '未找到编辑器。已复制到剪贴板。',
            enterApiKey: '请输入API密钥',
            serviceInitFailed: '服务初始化失败',
            audioTooShort: '音频过短',
            noAudioDetected: '未检测到音频',
            localVadMissing: '未找到本地VAD模块，已切换为服务器端检测。请将 fvad.wasm 和 fvad.js 放在 {path}。'
        },
        error: {
            clipboardFailed: '复制到剪贴板失败',
            noteCreateFailed: '笔记创建失败。已复制到剪贴板。',
            apiKeyInvalid: '错误：API密钥验证失败',
            testError: '测试过程中发生错误',
            cleanupFailed: '处理失败：{error}',
            dictionaryParseFailed: '词典解析失败：{error}',
            dictionaryImportFailed: '导入失败：',
            noDictionaryData: '没有要导出的词典数据',
            dictionaryExportFailed: '词典导出失败'
        }
    },
    ui: {
        help: {
            dictionaryFromComma: '“来源词”支持用逗号分隔的多个模式（例如：模式1, 模式2）。'
        },
        commands: {
            openView: '打开视图'
        },
        buttons: {
            recordStart: '开始语音输入',
            recordStop: '停止语音输入',
            recordPushToTalk: '请继续说话...',
            recordStopPushToTalk: '松开停止',
            recordPreparing: '麦克风准备中...',
            cleanup: '文本整理',
            copy: '复制',
            insert: '插入到笔记',
            insertAtCursor: '在光标处插入',
            append: '添加到末尾',
            clear: '清除',
            cancel: '取消',
            connectionTest: '连接测试',
            testing: '测试中...',
            testSuccess: '成功',
            testFailed: '失败',
            reset: '重置为默认值',
            export: '导出',
            import: '导入'
        },
        placeholders: {
            textarea: '语音转文字结果将显示在这里...',
            apiKey: 'sk-...',
            language: 'zh'
        },
        titles: {
            main: 'Voice Input',
            settings: 'Voice Input 设置'
        },
        settings: {
            apiKey: 'OpenAI API 密钥',
            apiKeyDesc: '用于语音转文字的OpenAI API密钥',
            aiPostProcessing: '词典校正',
            aiPostProcessingDesc: '使用词典对语音转文字结果进行校正',
            transcriptionCorrection: '语音转文字校正',
            transcriptionCorrectionDesc: '应用词典校正以生成更准确的文本',
            transcriptionModel: '语音转文字模型',
            transcriptionModelDesc: '选择用于语音识别的模型',
            maxRecordingDuration: '最大录音时长',
            maxRecordingDurationDesc: '最大录音时间（秒）（{min}秒～{max}分钟）',
            language: '语音识别语言',
            languageDesc: '设置用于语音识别和转录的语言。',
            transcriptionLanguage: '语音识别语言',
            transcriptionLanguageDesc: '设置用于语音识别和转录的语言。',
            pluginLanguage: '插件语言',
            pluginLanguageDesc: '设置UI显示、语音处理和校正词典的语言',
            // 高级设置
            languageLinking: '关联UI语言与识别语言',
            languageLinkingDesc: '启用时，识别语言跟随UI语言。禁用时，可独立设置识别语言。',
            advancedTranscriptionLanguage: '识别语言（高级设置）',
            advancedTranscriptionLanguageDesc: '独立设置语音识别的语言。',
            customDictionary: '自定义词典',
            customDictionaryDesc: '管理用于后处理的校正词典',
            dictionaryDefinite: '固定校正（最多{max}个）',
            dictionaryImportExport: '词典导入/导出',
            dictionaryImportExportDesc: '将校正词典作为JSON文件导入或导出',
            vadMode: '语音活动检测（VAD）',
            vadModeDesc: '默认的“关闭”会保持原始音频，以获得最高的转写精度。启用服务器VAD可以在上传前剪掉静音，可能减少带宽并加快响应，但也可能影响分段精度。本地VAD（需要 fvad.wasm / fvad.js）会在桌面端检测静音并自动停止录音。',
            vadModeLocalMissing: '启用本地VAD需要将 fvad.wasm 和 fvad.js 放在 {path}。',
            vadModeLocalAvailable: '在 {path} 检测到本地VAD模块，将在静音时自动停止录音。',
            vadModeDisabledDesc: '关闭VAD：持续录音并完整发送音频。'
        },
        options: {
            modelMini: 'GPT-4o mini Transcribe',
            modelFull: 'GPT-4o Transcribe',
            languageAuto: '自动',
            languageJa: '日语',
            languageEn: '英语',
            languageZh: '中文',
            languageKo: '韩语',
            vadServer: '服务器（可能更快）',
            vadLocal: '本地（需要 fvad.wasm）',
            vadDisabled: '关闭（默认）'
        },
        tooltips: {
            copy: '复制到剪贴板',
            insert: '在光标处插入',
            insertAtCursor: '在光标处插入',
            append: '添加到笔记末尾',
            clear: '按两次清除文本区域',
            settingsButton: '打开设置'
        },
        units: {
            seconds: '秒',
            minutes: '分钟'
        },
        labels: {
            from: '输入词',
            fromMultiple: '输入词（逗号分隔）',
            to: '校正词',
            context: '语境关键词'
        }
    }
};
