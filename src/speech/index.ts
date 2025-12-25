export { getSpeechClient, getRecognizerPath } from './client';
export { createSpeechSession, writeAudioToSession, closeSpeechSession, flushPendingTranscript } from './session';
export { CircularBuffer } from './circular-buffer';
export {
  SpeechSession,
  SpeechConfigV2,
  speechSessions,
  StreamingRecognizeResponseV2,
  STREAM_RESTART_CONSTANTS,
} from './types';
