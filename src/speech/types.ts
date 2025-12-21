import { Writable } from 'stream';

export interface SpeechConfig {
  encoding: 'LINEAR16' | 'MULAW' | 'FLAC';
  sampleRateHertz: number;
  languageCode: string;
}

export interface SpeechSession {
  sessionId: string;
  recognizeStream: Writable | null;
  isActive: boolean;
  createdAt: number;
  config: SpeechConfig;
}

export const speechSessions = new Map<string, SpeechSession>();

export type SpeechResultCallback = (transcript: string, isFinal: boolean) => void;
