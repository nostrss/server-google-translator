export interface ClientMessage<T = unknown> {
  event: string;
  data?: T;
  requestId?: string;
}

export interface ServerMessage<T = unknown> {
  event: string;
  data?: T;
  requestId?: string;
  success: boolean;
  error?: string;
}

export const ClientEvents = {
  CONNECT: 'connect',
  START_SPEECH: 'start_speech',
  AUDIO_CHUNK: 'audio_chunk',
  STOP_SPEECH: 'stop_speech',
} as const;

export const ServerEvents = {
  CONNECTED: 'connected',
  ERROR: 'error',
  SPEECH_STARTED: 'speech_started',
  SPEECH_STOPPED: 'speech_stopped',
} as const;

export interface ConnectRequestData {
  clientId?: string;
}

export interface ConnectedResponseData {
  sessionId: string;
  message: string;
  timestamp: number;
}

export interface StartSpeechRequestData {
  sampleRateHertz?: number;
  languageCode?: string;
}

export interface AudioChunkData {
  audio: string;
}

export interface SpeechStartedResponseData {
  message: string;
}

export interface SpeechStoppedResponseData {
  message: string;
}
