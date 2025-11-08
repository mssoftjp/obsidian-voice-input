import { Notice, MarkdownView, normalizePath } from 'obsidian';
import { AudioRecorder } from '../core';
import { TranscriptionService } from '../core';
import { TranscriptionError, TranscriptionErrorType } from '../errors';
import { SecurityUtils } from '../security';
import { DraftManager } from '../managers';
import type { VoiceInputView } from './VoiceInputView';
import type VoiceInputPlugin from '../plugin';
import { getI18n, createServiceLogger } from '../services';
import type { I18nService } from '../interfaces';
import type { StopReason, RecordingState, AudioRecorderOptionsWithVAD, AudioRecorderOptionsWithoutVAD } from '../interfaces';
import { Logger, hasLocalVadAssets, getLocalVadInstructionsPath } from '../utils';
import { DEFAULT_AUDIO_SETTINGS, DEFAULT_VAD_SETTINGS } from '../config';

/**
 * Handles all recording and text manipulation actions for the Voice Input View
 */
export class VoiceInputViewActions {
    private view: VoiceInputView;
    private plugin: VoiceInputPlugin;
    private i18n: I18nService;
    private logger: Logger;

    audioRecorder: AudioRecorder | null = null;
    transcriptionService: TranscriptionService | null = null;
    recordingState: RecordingState = {
        isRecording: false,
        isPushToTalkMode: false,
        processingQueue: [],
        activeVadMode: 'server'
    };
    private isProcessingAudio = false;
    // 連打や高速操作による並行実行を防ぐための遷移ロック
    private isTransitioning = false;
    private statusTimer: NodeJS.Timeout | null = null;
    private clearConfirmTimer: NodeJS.Timeout | null = null;
    private clearPressCount = 0;
    private pendingVadAutoStop = false;

    constructor(view: VoiceInputView, plugin: VoiceInputPlugin) {
        this.view = view;
        this.plugin = plugin;
        this.i18n = getI18n();
        this.logger = createServiceLogger('VoiceInputViewActions');
    }

    get app() {
        return this.view.app;
    }

    /**
	 * Initialize services
	 */
    initializeServices(): void {
        // Initialize transcription service
        const decryptedApiKey = this.plugin.settings.openaiApiKey;
        this.transcriptionService = new TranscriptionService(
            decryptedApiKey,
            this.plugin.settings.customDictionary
        );
        this.applyTranscriptionSettings();
    }

    /**
	 * Apply transcription settings to the service
	 */
    private applyTranscriptionSettings() {
        if (!this.transcriptionService) return;

        this.transcriptionService.setModel(this.plugin.settings.transcriptionModel);
        // Apply transcription correction and custom dictionary settings
        this.transcriptionService.setTranscriptionCorrection(this.plugin.settings.enableTranscriptionCorrection);
        this.transcriptionService.setCustomDictionary(this.plugin.settings.customDictionary);

        // 後方互換性のため、詳細設定も更新
        this.transcriptionService.updateCorrectorSettings({
            enabled: this.plugin.settings.enableTranscriptionCorrection
        });
    }

    /**
	 * Update transcription service settings
	 */
    updateTranscriptionService(): void {
        if (this.transcriptionService) {
            const decryptedApiKey = this.plugin.settings.openaiApiKey;
            this.transcriptionService.updateApiKey(decryptedApiKey);
            this.transcriptionService.setCustomDictionary(this.plugin.settings.customDictionary);
            this.applyTranscriptionSettings();
        }
    }

    /**
	 * Handle microphone status changes
	 */
    private handleMicrophoneStatus(status: 'initializing' | 'ready' | 'error') {
        if (status === 'initializing') {
            this.view.ui.statusEl.setText(this.i18n.t('status.recording.micInit'));
            this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordPreparing'));
        } else if (status === 'ready') {
            this.view.ui.statusEl.setText(this.i18n.t('status.recording.recording'));
            // Show different text for push-to-talk mode
            if (this.recordingState.isPushToTalkMode) {
                this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordStopPushToTalk'));
            } else {
                this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordStop'));
            }
            this.view.ui.recordButton.addClass('recording');
        } else if (status === 'error') {
            this.view.ui.statusEl.setText(this.i18n.t('status.error'));
            this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordStart'));
            this.view.ui.recordButton.removeClass('recording');
            new Notice(this.i18n.t('error.audio.micInitFailed'));
        }
    }

    private handleVADStatusChange(status: 'speech' | 'silence') {
        if (status === 'speech') {
            this.pendingVadAutoStop = false;
            this.view.ui.statusEl.setText(this.i18n.t('status.recording.vadSpeech'));
        } else {
            this.pendingVadAutoStop = true;
            this.view.ui.statusEl.setText(this.i18n.t('status.recording.vadSilence'));
        }
    }

    /**
	 * Toggle recording on/off
	 */
    async toggleRecording() {
        if (this.isTransitioning) return; // 二重操作防止
        this.isTransitioning = true;
        if (this.audioRecorder && this.audioRecorder.isActive()) {
            try {
                await this.stopRecording();
            } finally {
                this.isTransitioning = false;
            }
        } else {
            try {
                await this.startRecording();
            } finally {
                this.isTransitioning = false;
            }
        }
    }

    /**
	 * Start recording
	 */
    async startRecording() {
        // Validate API key
        if (!this.plugin.settings.openaiApiKey) {
            new Notice(this.i18n.t('error.api.noKey'));
            return;
        }

        if (!SecurityUtils.validateOpenAIAPIKey(this.plugin.settings.openaiApiKey)) {
            new Notice(this.i18n.t('error.api.invalidKey'));
            return;
        }

        // Skip secure context check in Obsidian
        // Obsidian provides its own secure environment

        try {
            const desiredVadMode = this.plugin.settings.vadMode ?? 'server';
            const wantsLocalVad = desiredVadMode === 'local';
            const wantsDisabled = desiredVadMode === 'disabled';
            let localVadAvailable = false;

            if (wantsLocalVad) {
                localVadAvailable = await hasLocalVadAssets(this.app);
                if (!localVadAvailable) {
                    const pluginPath = getLocalVadInstructionsPath(this.app);
                    new Notice(this.i18n.t('notification.warning.localVadMissing', { path: pluginPath }));
                    this.logger.warn('Local VAD assets not found; falling back to server VAD', { pluginPath });
                }
            }

            const effectiveVadMode: 'server' | 'local' | 'disabled' = localVadAvailable
                ? 'local'
                : wantsDisabled
                    ? 'disabled'
                    : 'server';
            this.recordingState.activeVadMode = effectiveVadMode;
            this.pendingVadAutoStop = false;

            this.logger.info('Starting recording session', {
                requestedVadMode: desiredVadMode,
                effectiveVadMode,
                localVadAvailable,
                maxDuration: this.plugin.settings.maxRecordingSeconds
            });

            // Dispose existing audio recorder if any
            if (this.audioRecorder) {
                this.audioRecorder.dispose();
                this.audioRecorder = null;
            }

            // Update UI
            this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordStop'));
            this.view.ui.recordButton.addClass('recording');
            this.view.ui.statusEl.setText(this.i18n.t('status.recording.preparing'));
            this.view.ui.setButtonsEnabled(false);
            this.view.ui.showCancelButton(true); // Show cancel button

            const handleSpeechEnd = async (audioBlob: Blob) => {
                this.recordingState.isRecording = false;
                const reasonType: StopReason['type'] = (this.recordingState.activeVadMode === 'local' && this.pendingVadAutoStop)
                    ? 'vad-auto'
                    : 'max-duration';
                this.pendingVadAutoStop = false;
                this.updateUIAfterStop();
                await this.processRecordedAudio(audioBlob, { type: reasonType });
            };

            const handleMicrophoneStatusChange = (status: 'initializing' | 'ready' | 'error') => {
                this.handleMicrophoneStatus(status);
            };

            if (effectiveVadMode === 'local') {
                const vadOptions: AudioRecorderOptionsWithVAD = {
                    useVAD: true,
                    app: this.app,
                    onSpeechEnd: handleSpeechEnd,
                    onMicrophoneStatusChange: handleMicrophoneStatusChange,
                    onVADStatusChange: (status) => this.handleVADStatusChange(status),
                    visualizerContainer: this.view.ui.visualizerContainer,
                    useSimpleVisualizer: false,
                    maxRecordingSeconds: this.plugin.settings.maxRecordingSeconds,
                    autoStopSilenceDuration: DEFAULT_AUDIO_SETTINGS.autoStopSilenceDuration,
                    vadMode: DEFAULT_VAD_SETTINGS.mode,
                    minSpeechDuration: DEFAULT_VAD_SETTINGS.minSpeechDuration,
                    minSilenceDuration: DEFAULT_VAD_SETTINGS.minSilenceDuration
                };
                this.audioRecorder = new AudioRecorder(vadOptions);
            } else {
                const continuousOptions: AudioRecorderOptionsWithoutVAD = {
                    useVAD: false,
                    onSpeechEnd: handleSpeechEnd,
                    onMicrophoneStatusChange: handleMicrophoneStatusChange,
                    visualizerContainer: this.view.ui.visualizerContainer,
                    useSimpleVisualizer: false,
                    maxRecordingSeconds: this.plugin.settings.maxRecordingSeconds
                };
                this.audioRecorder = new AudioRecorder(continuousOptions);
            }

            await this.audioRecorder.initialize();
            await this.audioRecorder.startRecording();
            this.recordingState.isRecording = true;

            // Enable other buttons
            this.view.ui.setButtonsEnabled(true);

        } catch (error) {
            const transcriptionError = error instanceof TranscriptionError
                ? error
                : TranscriptionError.fromError(error, TranscriptionErrorType.AUDIO_DEVICE_ERROR);

            this.logger.error('Error starting recording', transcriptionError);
            this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordStart'));
            this.view.ui.recordButton.removeClass('recording');
            this.view.ui.statusEl.setText(this.i18n.t('status.error'));
            this.view.ui.setButtonsEnabled(true);
            new Notice(transcriptionError.getLocalizedMessage());
        }
    }

    /**
	 * Stop recording with reason
	 */
    async stopRecording(reason?: StopReason) {
        if (!this.audioRecorder) {
            return;
        }

        this.pendingVadAutoStop = false;
        // Default to manual stop if no reason provided
        const stopReason = reason || { type: 'manual' as const };
        this.recordingState.lastStopReason = stopReason;

        try {
            this.logger.info('Stopping recording session', {
                reason: stopReason.type,
                hasAudioRecorder: !!this.audioRecorder
            });

            // Get the audio blob before destroying the recorder
            const audioBlob = await this.audioRecorder.stopRecording();

            // Clean up audio recorder (check if still exists)
            if (this.audioRecorder) {
                this.audioRecorder.dispose();
                this.audioRecorder = null;
            }
            this.recordingState.isRecording = false;

            // Update UI once
            this.updateUIAfterStop();

            // Process audio for manual stop
            if (audioBlob && audioBlob.size > 0) {
                await this.processRecordedAudio(audioBlob, stopReason);
            }

        } catch (error) {
            const transcriptionError = error instanceof TranscriptionError
                ? error
                : TranscriptionError.fromError(error, TranscriptionErrorType.AUDIO_DEVICE_ERROR);

            this.logger.error('Error stopping recording', transcriptionError);
            this.updateUIAfterError();
            new Notice(transcriptionError.getLocalizedMessage());
        }
    }

    /**
	 * Update UI after recording stops
	 */
    private updateUIAfterStop(): void {
        if (this.view.ui.recordButton) {
            this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordStart'));
            this.view.ui.recordButton.removeClass('recording');
        }
        if (this.view.ui.statusEl) {
            this.view.ui.statusEl.setText(this.i18n.t('status.idle'));
            this.view.ui.statusEl.removeClass('processing');
            this.view.ui.statusEl.removeClass('error');
        }
        this.view.ui.showCancelButton(false); // Hide cancel button
    }

    /**
	 * Update UI after error
	 */
    private updateUIAfterError(): void {
        if (this.view.ui.recordButton) {
            this.view.ui.recordButton.setText(this.i18n.t('ui.buttons.recordStart'));
            this.view.ui.recordButton.removeClass('recording');
        }
        if (this.view.ui.statusEl) {
            this.view.ui.statusEl.setText(this.i18n.t('status.error'));
            this.view.ui.statusEl.removeClass('processing');
            this.view.ui.statusEl.addClass('error');
        }
        this.view.ui.showCancelButton(false); // Hide cancel button
    }

    /**
	 * Set status text and clear it after a timeout
	 */
    setStatusWithTimeout(text: string, timeout = 3000): void {
        if (!this.view.ui.statusEl) return;

        // Clear existing timer
        if (this.statusTimer) {
            clearTimeout(this.statusTimer);
            this.statusTimer = null;
        }

        // Set new status
        this.view.ui.statusEl.setText(text);
        this.view.ui.statusEl.removeClass('processing');
        this.view.ui.statusEl.removeClass('error');

        // Set timer to clear status
        this.statusTimer = setTimeout(() => {
            if (this.view.ui.statusEl && !this.recordingState.isRecording && !this.isProcessingAudio) {
                this.view.ui.statusEl.setText(this.i18n.t('status.idle'));
            }
            this.statusTimer = null;
        }, timeout);
    }

    /**
	 * Process recorded audio with proper notifications
	 */
    private async processRecordedAudio(audioBlob: Blob, stopReason: StopReason): Promise<void> {
        // Show appropriate status based on stop reason
        if (this.view.ui.statusEl) {
            switch (stopReason.type) {
                case 'vad-auto':
                    this.setStatusWithTimeout(this.i18n.t('status.transcription.vadAutoStopped'));
                    break;
                case 'max-duration':
                    this.setStatusWithTimeout(this.i18n.t('status.transcription.maxDurationReached'));
                    break;
				// No status update for manual stop
            }
        }

        // Add to queue
        this.recordingState.processingQueue.push({
            audioBlob,
            timestamp: Date.now(),
            stopReason
        });

        // Always update status when queue changes (unless a timed status is active)
        if (!this.statusTimer) {
            this.updateProcessingStatus();
        }

        // Process queue if not already processing
        if (!this.isProcessingAudio) {
            this.processQueue();
        }
    }

    /**
	 * Process items from the queue
	 */
    private async processQueue(): Promise<void> {
        if (this.isProcessingAudio || this.recordingState.processingQueue.length === 0) {
            return;
        }

        this.isProcessingAudio = true;

        while (this.recordingState.processingQueue.length > 0) {
            // Get the first item without removing it yet
            const item = this.recordingState.processingQueue[0];
            if (!item) {
                this.recordingState.processingQueue.shift();
                continue;
            }

            // Update status before processing (queue still contains current item)
            this.updateProcessingStatus();

            try {
                await this.handleSpeechEnd(item.audioBlob);
            } catch (error) {
                this.logger.error('Error processing audio', error);
            } finally {
                // Remove the processed item after completion
                this.recordingState.processingQueue.shift();
            }
        }

        this.isProcessingAudio = false;
        // Don't update status here if a status timer is active
        // This prevents overwriting status messages set by setStatusWithTimeout
        if (!this.statusTimer) {
            this.updateProcessingStatus();
        }

        // Check if new items were added while processing
        if (this.recordingState.processingQueue.length > 0) {
            // Use setTimeout to avoid potential stack overflow
            setTimeout(() => this.processQueue(), 0);
        }
    }

    /**
	 * Update processing status display
	 */
    private updateProcessingStatus(): void {
        if (!this.view.ui.statusEl) return;

        // Don't update if a status message with timer is active
        if (this.statusTimer) return;

        const queueLength = this.recordingState.processingQueue.length;

        if (this.isProcessingAudio) {
            let statusText = this.i18n.t('status.processing.transcribing');
            // When processing, the first item is being processed, others are waiting
            const waitingCount = queueLength > 0 ? queueLength - 1 : 0;
            if (waitingCount > 0) {
                statusText += ` (${waitingCount} ${this.i18n.t('status.processing.waiting')})`;
            }
            this.view.ui.statusEl.setText(statusText);
            this.view.ui.statusEl.addClass('processing');
            this.view.ui.statusEl.removeClass('error');
        } else if (!this.recordingState.isRecording) {
            this.view.ui.statusEl.setText(this.i18n.t('status.idle'));
            this.view.ui.statusEl.removeClass('processing');
            this.view.ui.statusEl.removeClass('error');
        }
    }

    /**
	 * Handle speech end event from audio recorder
	 * @param audioBlob - The recorded audio blob
	 */
    async handleSpeechEnd(audioBlob: Blob): Promise<void> {

        // Validate that the view and UI components are still valid
        if (!this.view || !this.view.ui || !this.view.ui.textArea) {
            return;
        }

        // Check if the plugin is still active
        if (!this.plugin || !this.app) {
            return;
        }

        // Skip extremely small audio blobs (likely empty or corrupt)
        // WebM header alone is ~200-300 bytes, so anything under 500 bytes is suspicious
        const MIN_VALID_AUDIO_SIZE = 500; // bytes
        // Minimum valid audio size for continuous recording
        const minSpeechBytes = MIN_VALID_AUDIO_SIZE;

        if (audioBlob.size < minSpeechBytes) {
            this.setStatusWithTimeout(this.i18n.t('status.transcription.audioTooShort'));
            return;
        }

        // Ensure transcription service is initialized
        if (!this.transcriptionService) {
            this.initializeServices();

            // Re-validate after async initialization
            if (!this.transcriptionService) {
                return;
            }
        }

        try {
            // No longer block UI during processing - allow parallel recording
            // Update status is now handled by updateProcessingStatus()

            // Transcribe audio
            if (!this.transcriptionService) {
                throw new Error('Transcription service not available');
            }
            const result = await this.transcriptionService.transcribeAudio(audioBlob, this.plugin.getResolvedLanguage());

            // Check if result is empty
            if (!result.text || result.text.trim() === '') {
                this.setStatusWithTimeout(this.i18n.t('status.transcription.noAudioDetected'));
                return;
            }

            // Validate UI elements still exist before updating them
            if (this.view.ui.textArea) {
                // Append to text area
                if (this.view.ui.textArea.value) {
                    this.view.ui.textArea.value += '\n\n';
                }
                this.view.ui.textArea.value += result.text;

                // Auto scroll to bottom
                this.view.ui.textArea.scrollTop = this.view.ui.textArea.scrollHeight;

                // Auto-save draft after successful transcription
                this.saveDraft();

                // Show success status briefly
                this.setStatusWithTimeout(this.i18n.t('status.processing.completed'));
            } else {
                this.logger.error('TextArea not found during transcription insertion');
            }

            // Queue status will be updated after timeout by updateProcessingStatus()

        } catch (error) {
            const transcriptionError = error instanceof TranscriptionError
                ? error
                : TranscriptionError.fromError(error, TranscriptionErrorType.TRANSCRIPTION_FAILED);

            this.logger.error('Transcription error', transcriptionError);
            new Notice(transcriptionError.getLocalizedMessage());
            if (this.view.ui.statusEl) {
                this.view.ui.statusEl.setText(this.i18n.t('status.error'));
                this.view.ui.statusEl.addClass('error');
                this.view.ui.statusEl.removeClass('processing');
            }
        } finally {
            // Processing state is now managed by processQueue
        }
    }

    /**
	 * Clear text from textarea
	 */
    clearText() {
        const text = this.view.ui.textArea.value.trim();
        if (!text) {
            this.setStatusWithTimeout(this.i18n.t('status.warning.noTextToClear'));
            return;
        }

        // Double-press confirmation (3 seconds timeout)
        this.clearPressCount++;

        if (this.clearPressCount === 1) {
            // First press - show confirmation message
            this.setStatusWithTimeout(this.i18n.t('status.warning.clearConfirm'));

            // Set timer to reset press count
            this.clearConfirmTimer = setTimeout(() => {
                this.clearPressCount = 0;
                this.clearConfirmTimer = null;
            }, 3000);
        } else if (this.clearPressCount === 2) {
            // Second press within timeout - clear the text
            if (this.clearConfirmTimer) {
                clearTimeout(this.clearConfirmTimer);
                this.clearConfirmTimer = null;
            }
            this.clearPressCount = 0;

            // Clear the text
            this.view.ui.textArea.value = '';
            this.setStatusWithTimeout(this.i18n.t('status.memoCleared'));
        }
    }

    /**
	 * Copy text to clipboard
	 */
    async copyToClipboard() {
        const text = this.view.ui.textArea.value.trim();
        if (!text) {
            this.setStatusWithTimeout(this.i18n.t('status.warning.noTextToCopy'));
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            this.setStatusWithTimeout(this.i18n.t('status.clipboardCopied'));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Clipboard copy error', error);
            new Notice(this.i18n.t('notification.error.clipboardFailed') + ': ' + errorMessage);
            this.view.ui.statusEl.setText(this.i18n.t('status.error'));
        }
    }

    /**
	 * Clean up text using GPT
	 */
    async cleanupText() {
        if (!this.view.ui.textArea.value.trim()) {
            this.setStatusWithTimeout(this.i18n.t('status.warning.noTextToCleanup'));
            return;
        }

        // Ensure transcription service is initialized
        if (!this.transcriptionService) {
            this.initializeServices();
        }

        if (!this.transcriptionService) {
            new Notice(this.i18n.t('notification.warning.serviceInitFailed'));
            return;
        }

        try {
            this.view.ui.statusEl.setText(this.i18n.t('status.cleanupInProgress'));
            this.view.ui.setButtonsEnabled(false);

            // Use the dictionary corrector for cleanup
            const corrector = this.transcriptionService.getCorrector();
            const cleanedText = await corrector.correct(this.view.ui.textArea.value);
            this.view.ui.textArea.value = cleanedText;

            this.setStatusWithTimeout(this.i18n.t('status.cleanupCompleted'));

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Cleanup error', error);
            new Notice(this.i18n.t('notification.error.cleanupFailed') + errorMessage);
            this.view.ui.statusEl.setText(this.i18n.t('status.error'));
        } finally {
            this.view.ui.setButtonsEnabled(true);
        }
    }

    /**
	 * Cancel recording without processing
	 */
    async cancelRecording() {
        if (this.isTransitioning) return; // 二重キャンセル防止
        this.isTransitioning = true;
        if (!this.audioRecorder || !this.audioRecorder.isActive()) {
            this.isTransitioning = false;
            return;
        }

        try {
            // Stop recording and discard audio
            await this.audioRecorder.stopRecording();

            // Clean up audio recorder
            if (this.audioRecorder) {
                this.audioRecorder.dispose();
                this.audioRecorder = null;
            }

            this.recordingState.isRecording = false;

            // Update UI
            this.updateUIAfterStop();
            this.view.ui.setButtonsEnabled(true);
            this.setStatusWithTimeout(this.i18n.t('status.recording.cancelled'));

        } catch (error) {
            this.logger.error('Error cancelling recording', error);
            this.updateUIAfterError();
            this.view.ui.setButtonsEnabled(true);
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
	 * Insert text to active markdown note
	 */
    async insertToNote() {
        const text = this.view.ui.textArea.value.trim();
        if (!text) {
            this.setStatusWithTimeout(this.i18n.t('status.warning.noTextToInsert'));
            return;
        }

        // Use ViewManager to find a suitable markdown view
        const viewManager = this.plugin.getViewManager();
        let targetView: MarkdownView | null = viewManager.findTargetMarkdownView();

        // Method 4: Create a new note as fallback
        if (!targetView) {
            try {
                // Generate timestamp for filename
                const timestamp = new Date().toISOString()
                    .replace(/T/, '-')
                    .replace(/:/g, '-')
                    .replace(/\..+/, '');

                const fileName = `Voice-Memo-${timestamp}.md`;
                const normalizedFileName = normalizePath(fileName);
                const newFile = await this.app.vault.create(normalizedFileName, '');

                // Open the new file in a new tab for better UX
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(newFile);
                if (leaf.view instanceof MarkdownView) {
                    targetView = leaf.view;
                } else {
                    throw new Error('Failed to open markdown view for new file');
                }

                new Notice(this.i18n.t('notification.success.newNoteCreated'));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                new Notice(this.i18n.t('notification.error.noteCreateFailed') + ': ' + errorMessage);
                await navigator.clipboard.writeText(text);
                return;
            }
        }

        // Insert the text
        if (targetView && targetView.editor) {
            const editor = targetView.editor;

            // Make the target view active
            this.app.workspace.setActiveLeaf(targetView.leaf, { focus: true });

            // Get cursor position
            const cursor = editor.getCursor();

            // Insert at cursor position
            editor.replaceRange(text, cursor);

            // Move cursor to end of inserted text
            const newCursor = {
                line: cursor.line,
                ch: cursor.ch + text.length
            };
            editor.setCursor(newCursor);

            // Clear text area after insertion
            this.view.ui.textArea.value = '';
            this.setStatusWithTimeout(this.i18n.t('status.noteInserted'));

            // ViewManagerがターゲットビューを記録（必要に応じて）
        } else {
            new Notice(this.i18n.t('notification.warning.noEditorFound'));
            await navigator.clipboard.writeText(text);
        }
    }

    /**
     * Append text to the end of active markdown note
     */
    async appendToNote() {
        const text = this.view.ui.textArea.value.trim();
        if (!text) {
            this.setStatusWithTimeout(this.i18n.t('status.warning.noTextToInsert'));
            return;
        }

        // Use ViewManager to find a suitable markdown view
        const viewManager = this.plugin.getViewManager();
        let targetView: MarkdownView | null = viewManager.findTargetMarkdownView();

        // Create a new note as fallback (same logic as insertToNote)
        if (!targetView) {
            try {
                // Generate timestamp for filename
                const timestamp = new Date().toISOString()
                    .replace(/T/, '-')
                    .replace(/:/g, '-')
                    .replace(/\..+/, '');

                const fileName = `Voice-Memo-${timestamp}.md`;
                const normalizedFileName = normalizePath(fileName);
                const newFile = await this.app.vault.create(normalizedFileName, '');

                // Open the new file in a new tab for better UX
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(newFile);
                if (leaf.view instanceof MarkdownView) {
                    targetView = leaf.view;
                } else {
                    throw new Error('Failed to open markdown view for new file');
                }

                new Notice(this.i18n.t('notification.success.newNoteCreated'));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                new Notice(this.i18n.t('notification.error.noteCreateFailed') + ': ' + errorMessage);
                await navigator.clipboard.writeText(text);
                return;
            }
        }

        // Insert the text at the end of the document
        if (targetView && targetView.editor) {
            const editor = targetView.editor;

            // Make the target view active
            this.app.workspace.setActiveLeaf(targetView.leaf, { focus: true });

            // Get the last line of the document
            const lastLine = editor.lastLine();
            const lastLineLength = editor.getLine(lastLine).length;

            // Insert at end with proper spacing
            const insertPosition = { line: lastLine, ch: lastLineLength };
            const textToInsert = '\n\n' + text;
            editor.replaceRange(textToInsert, insertPosition);

            // Move cursor to end of inserted text
            const newCursor = {
                line: lastLine + 2,
                ch: text.length
            };
            editor.setCursor(newCursor);

            // Clear text area after insertion
            this.view.ui.textArea.value = '';
            this.setStatusWithTimeout(this.i18n.t('status.noteAppended'));

        } else {
            new Notice(this.i18n.t('notification.warning.noEditorFound'));
            await navigator.clipboard.writeText(text);
        }
    }

    /**
	 * Clean up resources
	 */
    destroy() {
        // Clear processing queue
        this.recordingState.processingQueue = [];
        this.isProcessingAudio = false;

        // Clear status timer
        if (this.statusTimer) {
            clearTimeout(this.statusTimer);
            this.statusTimer = null;
        }

        // Clear clear confirm timer
        if (this.clearConfirmTimer) {
            clearTimeout(this.clearConfirmTimer);
            this.clearConfirmTimer = null;
        }

        // Stop and clean up audio recorder
        if (this.audioRecorder) {
            // First stop recording if active
            this.audioRecorder.stopRecording().catch(error => {
                this.logger.error('Error stopping recording during destroy', error);
            });

            // Then destroy the recorder
            this.audioRecorder.dispose();
            this.audioRecorder = null;
        }

        // Clear any references to prevent memory leaks
        this.transcriptionService = null;
    }

    /**
	 * Save current text as draft
	 */
    private async saveDraft() {
        if (this.view.ui?.textArea?.value) {
            await DraftManager.saveDraft(this.app, this.view.ui.textArea.value, 'auto-save-transcription');
        }
    }
}
