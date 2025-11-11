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
        idle: 'Status: idle',
        memoCleared: 'Status: memo cleared',
        clipboardCopied: 'Status: copied to clipboard',
        noteInserted: 'Status: inserted into note',
        noteAppended: 'Status: appended to end of note',
        cleanupInProgress: 'Status: processing...',
        cleanupCompleted: 'Status: processing completed',
        draftRestored: 'Status: previous draft restored',
        recording: {
            preparing: 'Status: preparing to record...',
            micInit: 'Status: initializing microphone...',
            recording: 'Status: recording...',
            stopped: 'Status: stopped',
            cancelled: 'Status: cancelled',
            vadSpeech: 'Status: speech detected',
            vadSilence: 'Status: silence detected'
        },
        processing: {
            transcribing: 'Status: transcribing...',
            correcting: 'Status: correcting...',
            completed: 'Status: completed',
            waiting: 'Status: waiting'
        },
        transcription: {
            vadAutoStopped: 'Status: auto-stopped due to silence',
            maxDurationReached: 'Status: maximum duration reached',
            audioTooShort: 'Status: audio is too short',
            noAudioDetected: 'Status: no audio detected'
        },
        warning: {
            noTextToClear: 'Status: no text to clear',
            noTextToCopy: 'Status: no text to copy',
            noTextToCleanup: 'Status: no text to process',
            noTextToInsert: 'Status: no text to insert',
            clearConfirm: 'Status: press again to clear'
        },
        error: 'Status: error'
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
            enterApiKey: 'Please enter an API key',
            serviceInitFailed: 'Service initialization failed',
            audioTooShort: 'Audio is too short',
            noAudioDetected: 'No audio detected',
            localVadMissing: 'Local VAD module not found. Using server-side detection instead. Place fvad.wasm and fvad.js under {path}.'
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
            recordStart: 'Start voice input',
            recordStop: 'Stop voice input',
            recordPushToTalk: 'Keep speaking...',
            recordStopPushToTalk: 'Release to stop',
            recordPreparing: 'Preparing mic...',
            cleanup: 'Clean up',
            copy: 'Copy',
            insert: 'Insert to note',
            insertAtCursor: 'Insert at cursor',
            append: 'Append to end',
            clear: 'Clear',
            cancel: 'Cancel',
            connectionTest: 'Test connection',
            testing: 'Testing...',
            testSuccess: 'Success',
            testFailed: 'Failed',
            reset: 'Reset to default',
            export: 'Export',
            import: 'Import'
        },
        placeholders: {
            textarea: 'Voice transcription will appear here...',
            apiKey: 'Starts with sk-...',
            language: 'Example: en'
        },
        titles: {
            main: 'Voice input',
            settings: 'Voice input settings'
        },
        settings: {
            apiKey: 'OpenAI API key',
            apiKeyDesc: 'Your OpenAI API key for transcription',
            aiPostProcessing: 'Dictionary correction',
            aiPostProcessingDesc: 'Apply dictionary-based corrections to transcription results',
            transcriptionCorrection: 'Transcription correction',
            transcriptionCorrectionDesc: 'Apply dictionary corrections for more accurate text',
            transcriptionModel: 'Transcription model',
            transcriptionModelDesc: 'Select the model for voice recognition',
            maxRecordingDuration: 'Max recording duration',
            maxRecordingDurationDesc: 'Maximum recording time in seconds ({min}s - {max}min)',
            language: 'Voice recognition language',
            languageDesc: 'Language for voice recognition and transcription.',
            transcriptionLanguage: 'Transcription language',
            transcriptionLanguageDesc: 'Language for voice recognition and transcription.',
            pluginLanguage: 'Plugin language',
            pluginLanguageDesc: 'Set language for UI display',
            // Advanced settings
            languageLinking: 'Link UI and recognition languages',
            languageLinkingDesc: 'When enabled, recognition language follows UI language. When disabled, you can set recognition language independently.',
            advancedTranscriptionLanguage: 'Recognition language (advanced)',
            advancedTranscriptionLanguageDesc: 'Set the language for voice recognition independently.',
            customDictionary: 'Custom dictionary',
            customDictionaryDesc: 'Manage corrections used for post-processing',
            dictionaryDefinite: 'Definite corrections (max {max})',
            dictionaryImportExport: 'Dictionary import/export',
            dictionaryImportExportDesc: 'Import or export your correction dictionary as JSON',
            vadMode: 'Voice activity detection',
            vadModeDesc: 'Off (default) keeps the raw audio for maximum accuracy. Server VAD can trim silence upstream for quicker turnaround but may slightly affect segmentation accuracy. Local VAD (requires fvad.wasm/fvad.js) stops recording automatically on the desktop.',
            vadModeLocalMissing: 'Local VAD requires fvad.wasm and fvad.js under {path}. Install them before switching.',
            vadModeLocalAvailable: 'Local VAD files found in {path}. Recording will auto-stop on silence.',
            vadModeDisabledDesc: 'Voice activity detection is disabled – audio is recorded continuously and sent untouched.',
            vadModeSummaryServer: 'Cuts silence on the server for faster turnaround (cloud processing).',
            vadModeSummaryLocal: 'Detects silence locally and auto-stops on desktop (requires fvad.wasm/fvad.js).',
            vadModeInstallButton: 'Choose fvad.wasm / fvad.js…',
            vadModeInstallDesc: 'Download fvad.wasm (and fvad.js) from the official WebRTC voice activity detection port, then choose the wasm file to copy it into the plugin folder (desktop only).',
            vadModeInstallLinkLabel: 'Visit the fvad-wasm project',
            vadModeInstallInvalidName: 'Please select a file named fvad.wasm.',
            vadModeInstallInvalidType: 'The selected file does not appear to be a WebAssembly module.',
            vadModeInstallSuccess: 'The fvad.wasm file is installed. Local voice activity detection will run the next time you record.',
            vadModeInstallWriteError: 'Failed to install VAD assets: {error}',
            vadModeInstallJsMissing: 'Local voice activity detection also needs fvad.js in the same plugin folder. Copy it manually if it is not present.'
        },
        options: {
            modelMini: 'GPT-4o mini transcribe',
            modelFull: 'GPT-4o transcribe',
            languageAuto: 'Auto',
            languageJa: 'Japanese',
            languageEn: 'English',
            languageZh: 'Chinese',
            languageKo: 'Korean',
            vadServer: 'Server (faster turnaround)',
            vadLocal: 'Local (requires fvad.wasm)',
            vadDisabled: 'Off (default)'
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
            seconds: 'Seconds',
            minutes: 'Minutes'
        },
        labels: {
            from: 'From',
            fromMultiple: 'From (comma-separated)',
            to: 'To',
            context: 'Context keywords'
        }
    }
};
