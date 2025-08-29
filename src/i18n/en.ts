/**
 * English translation resource
 */
import { TranslationResource } from '../interfaces';

export const en: TranslationResource = {
    error: {
        api: {
            noKey: 'OpenAI API key is not set',
            invalidKey: 'Invalid API key format',
            invalidKeyDetail: 'Invalid API key format. Please enter an API key starting with sk-',
            connectionFailed: 'Failed to connect to API',
            quotaExceeded: 'API quota exceeded',
            rateLimited: 'API rate limit reached. Please wait and try again.',
            unauthorized: 'Invalid API key. Please check your settings.'
        },
        audio: {
            micPermission: 'Microphone access permission required',
            micNotFound: 'Microphone not found',
            micInitFailed: 'Failed to initialize microphone',
            recordingFailed: 'Failed to start recording',
            audioContextFailed: 'Failed to create audio context'
        },
        transcription: {
            failed: 'Transcription failed',
            emptyResult: 'Transcription result is empty',
            serviceInitFailed: 'Failed to initialize service'
        },
        file: {
            createFailed: 'Failed to create file',
            notFound: 'File not found',
            wasmLoadFailed: 'Failed to load WebAssembly module'
        },
        general: {
            unknown: 'An unknown error occurred',
            network: 'Network error occurred',
            timeout: 'Request timed out',
            error: 'An error occurred',
            fatal: 'A fatal error occurred in the plugin. Please restart.',
            warning: 'Warning',
            default: 'A problem occurred during processing.'
        }
    },
    status: {
        idle: 'Status: Idle',
        memoCleared: 'Status: Memo cleared',
        clipboardCopied: 'Status: Copied to clipboard',
        noteInserted: 'Status: Inserted into note',
        noteAppended: 'Status: Appended to end of note',
        cleanupInProgress: 'Status: Processing...',
        cleanupCompleted: 'Status: Processing completed',
        draftRestored: 'Status: Previous draft restored',
        recording: {
            preparing: 'Status: Preparing to record...',
            micInit: 'Status: Initializing microphone...',
            recording: 'Status: Recording...',
            stopped: 'Status: Stopped',
            cancelled: 'Status: Cancelled'
        },
        processing: {
            transcribing: 'Status: Transcribing...',
            correcting: 'Status: Correcting...',
            completed: 'Status: Completed',
            waiting: 'waiting'
        },
        transcription: {
            vadAutoStopped: 'Status: Auto-stopped due to silence',
            maxDurationReached: 'Status: Maximum duration reached',
            audioTooShort: 'Status: Audio is too short',
            noAudioDetected: 'Status: No audio detected'
        },
        warning: {
            noTextToClear: 'Status: No text to clear',
            noTextToCopy: 'Status: No text to copy',
            noTextToCleanup: 'Status: No text to process',
            noTextToInsert: 'Status: No text to insert',
            clearConfirm: 'Status: Press again to clear'
        },
        error: 'Status: Error'
    },
    notification: {
        success: {
            copied: 'Copied to clipboard',
            inserted: 'Text inserted into note',
            cleared: 'Memo cleared',
            cleanupDone: 'Processing completed',
            newNoteCreated: 'New note created',
            dictionaryExported: 'Dictionary exported successfully',
            dictionaryImported: 'Dictionary imported successfully',
            apiKeyValid: 'Success: API key validation successful'
        },
        warning: {
            noTextToCopy: 'No text to copy',
            noTextToInsert: 'No text to insert',
            noTextToClear: 'No text to clear',
            noTextToCleanup: 'No text to process',
            noEditorFound: 'Editor not found. Copied to clipboard.',
            enterApiKey: 'Please enter API key',
            serviceInitFailed: 'Service initialization failed',
            audioTooShort: 'Audio is too short',
            noAudioDetected: 'No audio detected'
        },
        error: {
            clipboardFailed: 'Failed to copy to clipboard',
            noteCreateFailed: 'Failed to create note. Copied to clipboard.',
            apiKeyInvalid: 'Error: API key validation failed',
            testError: 'Error occurred during test',
            cleanupFailed: 'Processing failed: {error}',
            dictionaryParseFailed: 'Failed to parse dictionary: {error}',
            dictionaryImportFailed: 'Import failed: ',
            noDictionaryData: 'No dictionary data to export',
            dictionaryExportFailed: 'Failed to export dictionary'
        }
    },
    ui: {
        help: {
            dictionaryFromComma: 'Enter multiple source patterns separated by commas (e.g., "pattern 1, pattern 2").'
        },
        commands: {
            openView: 'Open view'
        },
        buttons: {
            recordStart: 'Start Voice Input',
            recordStop: 'Stop Voice Input',
            recordPushToTalk: 'Keep speaking...',
            recordStopPushToTalk: 'Release to stop',
            recordPreparing: 'Preparing mic...',
            cleanup: 'Clean Up',
            copy: 'Copy',
            insert: 'Insert to Note',
            insertAtCursor: 'Insert at Cursor',
            append: 'Append to End',
            clear: 'Clear',
            cancel: 'Cancel',
            connectionTest: 'Test Connection',
            testing: 'Testing...',
            testSuccess: 'Success',
            testFailed: 'Failed',
            reset: 'Reset to default',
            export: 'Export',
            import: 'Import'
        },
        placeholders: {
            textarea: 'Voice transcription will appear here...',
            apiKey: 'sk-...',
            language: 'en'
        },
        titles: {
            main: 'Voice Input',
            settings: 'Voice Input Settings'
        },
        settings: {
            apiKey: 'OpenAI API Key',
            apiKeyDesc: 'Your OpenAI API key for transcription',
            aiPostProcessing: 'Dictionary Correction',
            aiPostProcessingDesc: 'Apply dictionary-based corrections to transcription results',
            transcriptionCorrection: 'Transcription Correction',
            transcriptionCorrectionDesc: 'Apply dictionary corrections for more accurate text',
            transcriptionModel: 'Transcription Model',
            transcriptionModelDesc: 'Select the model for voice recognition',
            maxRecordingDuration: 'Max Recording Duration',
            maxRecordingDurationDesc: 'Maximum recording time in seconds ({min}s - {max}min)',
            language: 'Voice Recognition Language',
            languageDesc: 'Language for voice recognition and transcription.',
            transcriptionLanguage: 'Transcription Language',
            transcriptionLanguageDesc: 'Language for voice recognition and transcription.',
            pluginLanguage: 'Plugin Language',
            pluginLanguageDesc: 'Set language for UI display',
            // Advanced settings
            languageLinking: 'Link UI and recognition languages',
            languageLinkingDesc: 'When enabled, recognition language follows UI language. When disabled, you can set recognition language independently.',
            advancedTranscriptionLanguage: 'Recognition Language (Advanced)',
            advancedTranscriptionLanguageDesc: 'Set the language for voice recognition independently.',
            customDictionary: 'Custom Dictionary',
            customDictionaryDesc: 'Manage corrections used for post-processing',
            dictionaryDefinite: 'Definite Corrections (max {max})',
            dictionaryImportExport: 'Dictionary Import/Export',
            dictionaryImportExportDesc: 'Import or export your correction dictionary as JSON'
        },
        options: {
            modelMini: 'GPT-4o mini Transcribe',
            modelFull: 'GPT-4o Transcribe',
            languageAuto: 'Auto',
            languageJa: 'Japanese',
            languageEn: 'English',
            languageZh: 'Chinese',
            languageKo: 'Korean'
        },
        tooltips: {
            copy: 'Copy to clipboard',
            insert: 'Insert at cursor',
            insertAtCursor: 'Insert at cursor position',
            append: 'Append to end of note',
            clear: 'Press twice to clear text area',
            settingsButton: 'Open settings'
        },
        units: {
            seconds: 's',
            minutes: 'min'
        },
        labels: {
            from: 'From',
            fromMultiple: 'From (comma-separated)',
            to: 'To',
            context: 'Context Keywords'
        }
    }
};
