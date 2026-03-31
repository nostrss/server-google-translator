import { TranslationMode } from '../translate/translate.types';
import { ErrorCode } from '../common/constants/error-codes';

export enum ClientEvents {
  CONNECT = 'connect',
  START_SPEECH = 'start_speech',
  AUDIO_CHUNK = 'audio_chunk',
  STOP_SPEECH = 'stop_speech',
}

export enum ServerEvents {
  CONNECTED = 'connected',
  SPEECH_STARTED = 'speech_started',
  SPEECH_RESULT = 'speech_result',
  SPEECH_STOPPED = 'speech_stopped',
  TRANSLATION_RESULT = 'translation_result',
  ERROR = 'error',
}

export interface ClientMessage<T = unknown> {
  event: string;
  data?: T;
}

export interface ServerMessage<T = unknown> {
  event: string;
  data?: T;
  success: boolean;
  error?: { code: ErrorCode; message: string };
}

export interface ConnectRequestData {
  clientId?: string;
}

export interface StartSpeechRequestData {
  languageCode?: string;
  targetLanguageCode?: string;
  translationMode?: TranslationMode;
  sampleRateHertz?: number;
}

export interface AudioChunkData {
  audio: string;
}

export interface ConnectedResponseData {
  sessionId: string;
  message: string;
  timestamp: number;
}

export interface SpeechResultResponseData {
  transcript: string;
  isFinal: boolean;
  timestamp: number;
}

export interface TranslationResultResponseData {
  originalText: string;
  translatedText: string;
  isFinal: boolean;
  timestamp: number;
}
