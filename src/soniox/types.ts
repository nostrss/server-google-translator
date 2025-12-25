import WebSocket from 'ws';

// Soniox 설정 메시지
export interface SonioxConfigMessage {
  api_key: string;
  model: string;
  audio_format: string;
  sample_rate?: number;
  num_channels?: number;
  language_hints?: string[];
  enable_endpoint_detection?: boolean;
}

// Soniox 응답 토큰
export interface SonioxToken {
  text: string;
  start_ms?: number;
  duration_ms?: number;
  is_final?: boolean;
}

// Soniox 응답 메시지
export interface SonioxResponse {
  tokens?: SonioxToken[];
  is_final?: boolean;
  error_code?: number;
  error_message?: string;
}

// Soniox 세션
export interface SonioxSession {
  sessionId: string;
  sonioxWs: WebSocket | null;
  isActive: boolean;
  createdAt: number;
  currentChatId: string;
  accumulatedTranscript: string;
  pendingTranscript: string;
  config: {
    languageHints: string[];
  };
}

// 세션 저장소
export const sonioxSessions = new Map<string, SonioxSession>();

// 결과 콜백 타입
export type SonioxResultCallback = (transcript: string, isFinal: boolean) => void;

// Endpoint 콜백 타입 (<end> 토큰 수신 시)
export type SonioxEndpointCallback = (finalTranscript: string) => void;
