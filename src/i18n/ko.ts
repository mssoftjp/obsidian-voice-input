/**
 * Korean translation resource
 */
import { TranslationResource } from '../interfaces';

export const ko: TranslationResource = {
    error: {
        api: {
            noKey: 'OpenAI API 키가 설정되지 않았습니다',
            invalidKey: '유효하지 않은 API 키 형식입니다',
            invalidKeyDetail: '유효하지 않은 API 키 형식입니다. sk-로 시작하는 API 키를 입력해주세요.',
            connectionFailed: 'API 연결에 실패했습니다',
            quotaExceeded: 'API 사용량 한도에 도달했습니다',
            rateLimited: 'API 요청 제한에 도달했습니다. 잠시 후 다시 시도해주세요.',
            unauthorized: 'API 키가 유효하지 않습니다. 설정을 확인해주세요.'
        },
        audio: {
            micPermission: '마이크 액세스 권한이 필요합니다',
            micNotFound: '마이크를 찾을 수 없습니다',
            micInitFailed: '마이크 초기화에 실패했습니다',
            recordingFailed: '녹음 시작에 실패했습니다',
            audioContextFailed: '오디오 컨텍스트 생성에 실패했습니다'
        },
        transcription: {
            failed: '음성 텍스트 변환에 실패했습니다',
            emptyResult: '음성 텍스트 변환 결과가 비어있습니다',
            serviceInitFailed: '서비스 초기화에 실패했습니다'
        },
        file: {
            createFailed: '파일 생성에 실패했습니다',
            notFound: '파일을 찾을 수 없습니다',
            wasmLoadFailed: 'WebAssembly 모듈 로드에 실패했습니다'
        },
        general: {
            unknown: '알 수 없는 오류가 발생했습니다',
            network: '네트워크 오류가 발생했습니다',
            timeout: '요청 시간이 초과되었습니다',
            error: '오류가 발생했습니다',
            fatal: '플러그인에서 치명적인 오류가 발생했습니다. 재시작해주세요.',
            warning: '경고',
            default: '처리 중 문제가 발생했습니다.'
        }
    },
    status: {
        idle: '상태: 대기 중',
        memoCleared: '상태: 메모를 지웠습니다',
        clipboardCopied: '상태: 클립보드에 복사했습니다',
        noteInserted: '상태: 노트에 삽입했습니다',
        noteAppended: '상태: 노트 끝에 추가했습니다',
        cleanupInProgress: '상태: 처리 중...',
        cleanupCompleted: '상태: 처리 완료',
        draftRestored: '상태: 이전 초안을 복원했습니다',
        recording: {
            preparing: '상태: 녹음 준비 중...',
            micInit: '상태: 마이크 초기화 중...',
            recording: '상태: 녹음 중...',
            stopped: '상태: 중지됨',
            cancelled: '상태: 취소됨',
            vadSpeech: '상태: 음성을 감지했습니다',
            vadSilence: '상태: 무음을 감지했습니다'
        },
        processing: {
            transcribing: '상태: 음성 텍스트 변환 중...',
            correcting: '상태: 텍스트 정리 중...',
            completed: '상태: 완료',
            waiting: '대기 중'
        },
        transcription: {
            vadAutoStopped: '상태: 무음 감지로 자동 중지됨',
            maxDurationReached: '상태: 최대 녹음 시간에 도달했습니다',
            audioTooShort: '상태: 오디오가 너무 짧습니다',
            noAudioDetected: '상태: 오디오가 감지되지 않았습니다'
        },
        warning: {
            noTextToClear: '상태: 지울 텍스트가 없습니다',
            noTextToCopy: '상태: 복사할 텍스트가 없습니다',
            noTextToCleanup: '상태: 처리할 텍스트가 없습니다',
            noTextToInsert: '상태: 삽입할 텍스트가 없습니다',
            clearConfirm: '상태: 다시 눌러서 지우기'
        },
        error: '상태: 오류'
    },
    notification: {
        success: {
            copied: '클립보드에 복사했습니다',
            inserted: '텍스트를 노트에 삽입했습니다',
            cleared: '메모를 지웠습니다',
            cleanupDone: '처리가 완료되었습니다',
            newNoteCreated: '새 노트를 생성했습니다',
            dictionaryExported: '사전을 성공적으로 내보냈습니다',
            dictionaryImported: '사전을 성공적으로 가져왔습니다',
            apiKeyValid: '성공: API 키 검증 성공'
        },
        warning: {
            noTextToCopy: '복사할 텍스트가 없습니다',
            noTextToInsert: '삽입할 텍스트가 없습니다',
            noTextToClear: '지울 텍스트가 없습니다',
            noTextToCleanup: '처리할 텍스트가 없습니다',
            noEditorFound: '에디터를 찾을 수 없습니다. 클립보드에 복사했습니다.',
            enterApiKey: 'API 키를 입력해주세요',
            serviceInitFailed: '서비스 초기화에 실패했습니다',
            audioTooShort: '오디오가 너무 짧습니다',
            noAudioDetected: '오디오가 감지되지 않았습니다',
            localVadMissing: '로컬 VAD 모듈을 찾을 수 없어 서버 VAD로 전환합니다. {path} 에 fvad.wasm 및 fvad.js 를 배치하세요.'
        },
        error: {
            clipboardFailed: '클립보드 복사에 실패했습니다',
            noteCreateFailed: '노트 생성에 실패했습니다. 클립보드에 복사했습니다.',
            apiKeyInvalid: '오류: API 키 검증 실패',
            testError: '테스트 중 오류가 발생했습니다',
            cleanupFailed: '처리에 실패했습니다: {error}',
            dictionaryParseFailed: '사전 파싱에 실패했습니다: {error}',
            dictionaryImportFailed: '가져오기에 실패했습니다: ',
            noDictionaryData: '내보낼 사전 데이터가 없습니다',
            dictionaryExportFailed: '사전 내보내기에 실패했습니다'
        }
    },
    ui: {
        help: {
            dictionaryFromComma: '입력어는 쉼표로 여러 패턴을 지정할 수 있습니다(예: 패턴1, 패턴2).'
        },
        commands: {
            openView: '뷰 열기'
        },
        buttons: {
            recordStart: '음성 입력 시작',
            recordStop: '음성 입력 중지',
            recordPushToTalk: '계속 말해주세요...',
            recordStopPushToTalk: '놓으면 중지',
            recordPreparing: '마이크 준비 중...',
            cleanup: '텍스트 정리',
            copy: '복사',
            insert: '노트에 삽입',
            insertAtCursor: '커서 위치에 삽입',
            append: '끝에 추가',
            clear: '지우기',
            cancel: '취소',
            connectionTest: '연결 테스트',
            testing: '테스트 중...',
            testSuccess: '성공',
            testFailed: '실패',
            reset: '기본값으로 재설정',
            export: '내보내기',
            import: '가져오기'
        },
        placeholders: {
            textarea: '음성 텍스트 변환 결과가 여기에 표시됩니다...',
            apiKey: 'sk-...',
            language: 'ko'
        },
        titles: {
            main: 'Voice Input',
            settings: 'Voice Input 설정'
        },
        settings: {
            apiKey: 'OpenAI API 키',
            apiKeyDesc: '음성 텍스트 변환용 OpenAI API 키',
            aiPostProcessing: '사전 교정',
            aiPostProcessingDesc: '음성 텍스트 변환 결과를 사전으로 교정',
            transcriptionCorrection: '음성 텍스트 변환 교정',
            transcriptionCorrectionDesc: '사전 교정을 적용하여 더 정확한 텍스트 생성',
            transcriptionModel: '음성 텍스트 변환 모델',
            transcriptionModelDesc: '음성 인식에 사용할 모델 선택',
            maxRecordingDuration: '최대 녹음 시간',
            maxRecordingDurationDesc: '최대 녹음 시간(초) ({min}초~{max}분)',
            language: '음성 인식 언어',
            languageDesc: '음성 인식 및 전사를 위한 언어를 설정합니다.',
            transcriptionLanguage: '음성 인식 언어',
            transcriptionLanguageDesc: '음성 인식 및 전사를 위한 언어를 설정합니다.',
            pluginLanguage: '플러그인 언어',
            pluginLanguageDesc: 'UI 표시, 음성 처리 및 교정 사전의 언어 설정',
            // 고급 설정
            languageLinking: 'UI 언어와 인식 언어 연동',
            languageLinkingDesc: '활성화하면 인식 언어가 UI 언어를 따릅니다. 비활성화하면 인식 언어를 독립적으로 설정할 수 있습니다.',
            advancedTranscriptionLanguage: '인식 언어 (고급 설정)',
            advancedTranscriptionLanguageDesc: '음성 인식 언어를 독립적으로 설정합니다.',
            customDictionary: '사용자 정의 사전',
            customDictionaryDesc: '후처리에 사용되는 교정 사전 관리',
            dictionaryDefinite: '고정 교정 (최대 {max}개)',
            dictionaryImportExport: '사전 가져오기/내보내기',
            dictionaryImportExportDesc: '교정 사전을 JSON 파일로 가져오기 또는 내보내기',
            vadMode: '음성 활동 감지(VAD)',
            vadModeDesc: '기본값인 “끄기”는 원본 오디오를 그대로 전송하여 최고 정확도를 유지합니다. 서버 VAD를 켜면 업로드 전에 무음을 잘라 통신량이나 속도가 개선될 수 있지만, 분할 방식에 따라 정확도에 영향이 있을 수 있습니다. 로컬 VAD(fvad.wasm / fvad.js 필요)는 데스크톱에서 무음을 감지해 자동으로 녹음을 멈춥니다.',
            vadModeLocalMissing: '{path} 에 fvad.wasm 및 fvad.js 를 배치하면 로컬 VAD를 사용할 수 있습니다.',
            vadModeLocalAvailable: '{path} 에서 로컬 VAD 모듈을 감지했습니다. 무음 시 자동으로 녹음을 중지합니다.',
            vadModeDisabledDesc: 'VAD 끄기: 무음이 있어도 녹음을 계속 진행합니다.'
        },
        options: {
            modelMini: 'GPT-4o mini Transcribe',
            modelFull: 'GPT-4o Transcribe',
            languageAuto: '자동',
            languageJa: '일본어',
            languageEn: '영어',
            languageZh: '중국어',
            languageKo: '한국어',
            vadServer: '서버(통신량 절약)',
            vadLocal: '로컬(fvad.wasm 필요)',
            vadDisabled: '꺼짐(기본값)'
        },
        tooltips: {
            copy: '클립보드에 복사',
            insert: '커서 위치에 삽입',
            insertAtCursor: '커서 위치에 삽입',
            append: '노트 끝에 추가',
            clear: '두 번 눌러서 텍스트 영역 지우기',
            settingsButton: '설정 화면 열기'
        },
        units: {
            seconds: '초',
            minutes: '분'
        },
        labels: {
            from: '입력어',
            fromMultiple: '입력어（쉼표구분）',
            to: '교정어',
            context: '문맥 키워드'
        }
    }
};
