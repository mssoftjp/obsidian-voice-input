/**
 * Recording stop reason types
 */
export type StopReasonType = 'manual' | 'vad-auto' | 'max-duration' | 'error';

/**
 * Recording stop reason interface
 */
export interface StopReason {
  type: StopReasonType;
  message?: string;
}

/**
 * Audio processing queue item
 */
export interface AudioQueueItem {
  audioBlob: Blob;
  timestamp: number;
  stopReason: StopReason;
}

/**
 * Recording state interface
 */
export interface RecordingState {
  isRecording: boolean;
  isPushToTalkMode: boolean;
  lastStopReason?: StopReason;
  processingQueue: AudioQueueItem[];
}
