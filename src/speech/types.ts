import { Duplex } from 'stream';

export interface SpeechConfigV2 {
  languageCodes: string[];
  model: string;
}

export interface SpeechSession {
  sessionId: string;
  recognizeStream: Duplex | null;
  isActive: boolean;
  createdAt: number;
  config: SpeechConfigV2;
  configSent: boolean;
}

export const speechSessions = new Map<string, SpeechSession>();

export type SpeechResultCallback = (transcript: string, isFinal: boolean) => void;

export interface StreamingRecognizeResponseV2 {
  results?: Array<{
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
    }>;
    isFinal?: boolean;
  }>;
  speechEventType?: string;
}
