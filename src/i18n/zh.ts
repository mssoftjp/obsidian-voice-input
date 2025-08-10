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
            fatal: '插件发生致命错误。请重启。',
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
            cancelled: '状态：已取消'
        },
        processing: {
            transcribing: '状态：语音转文字中...',
            correcting: '状态：文本处理中...',
            completed: '状态：完成'
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
            noAudioDetected: '未检测到音频'
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
            openSettings: '打开设置',
            reset: '重置为默认值',
            preview: '预览JSON',
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
            settings: 'Voice Input 设置',
            visualizer: '音频级别'
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
            pluginLanguage: '插件语言',
            pluginLanguageDesc: '设置UI显示、语音处理和校正词典的语言',
            customDictionary: '自定义词典',
            customDictionaryDesc: '管理用于后处理的校正词典',
            dictionaryDefinite: '固定校正（最多{max}个）',
            dictionaryContextual: '语境校正（最多{max}个）',
            dictionaryImportExport: '词典导入/导出',
            dictionaryImportExportDesc: '将校正词典作为JSON文件导入或导出'
        },
        options: {
            modelMini: 'GPT-4o mini Transcribe',
            modelFull: 'GPT-4o Transcribe'
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
        },
    }
};
