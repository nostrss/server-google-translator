import WebSocket from 'ws';
import crypto from 'crypto';
import { createSonioxConnection } from './client';
import {
  SonioxSession,
  sonioxSessions,
  SonioxResultCallback,
  SonioxEndpointCallback,
  SonioxResponse,
} from './types';

export function createSonioxSession(
  sessionId: string,
  languageHints: string[],
  onResult?: SonioxResultCallback,
  onReady?: () => void,
  onEndpoint?: SonioxEndpointCallback
): SonioxSession {
  const session: SonioxSession = {
    sessionId,
    sonioxWs: null,
    isActive: true,
    createdAt: Date.now(),
    currentChatId: crypto.randomUUID(),
    accumulatedTranscript: '',
    pendingTranscript: '',
    config: { languageHints },
  };

  const sonioxWs = createSonioxConnection(
    languageHints,
    (response: SonioxResponse) => {
      if (response.tokens && response.tokens.length > 0) {
        // <end> 토큰 필터링
        const filteredTokens = response.tokens.filter((t) => t.text !== '<end>');

        if (filteredTokens.length === 0) {
          // <end> 토큰: 발화 완료
          console.log(`[${sessionId}] Soniox: <end> 토큰 수신 (endpoint 감지)`);
          const finalTranscript = session.accumulatedTranscript;

          if (onEndpoint && finalTranscript.trim()) {
            onEndpoint(finalTranscript);
          }

          // transcript 초기화 및 chatId 갱신
          session.accumulatedTranscript = '';
          session.pendingTranscript = '';
          session.currentChatId = crypto.randomUUID();
          console.log(`[${sessionId}] Soniox: chatId 갱신 → ${session.currentChatId}`);
          return;
        }

        // final 토큰과 non-final 토큰 분리
        const finalTokens = filteredTokens.filter((t) => t.is_final);
        const nonFinalTokens = filteredTokens.filter((t) => !t.is_final);

        // final 토큰만 누적
        if (finalTokens.length > 0) {
          session.accumulatedTranscript += finalTokens.map((t) => t.text).join('');
          session.pendingTranscript = '';
        }

        // non-final 토큰은 pendingTranscript로 (매번 대체)
        if (nonFinalTokens.length > 0) {
          session.pendingTranscript = nonFinalTokens.map((t) => t.text).join('');
        }

        // 중간 결과 전송: 확정된 텍스트 + 임시 텍스트
        const displayTranscript = session.accumulatedTranscript + session.pendingTranscript;

        console.log(
          `[${sessionId}] Soniox 중간: ${displayTranscript}`
        );

        // interim 결과 콜백
        if (onResult) {
          onResult(displayTranscript, false);
        }
      }
    },
    (error: Error) => {
      console.error(`Soniox 에러 [${sessionId}]:`, error.message);
      closeSonioxSession(sessionId);
    },
    () => {
      console.log(`Soniox 연결 종료 [${sessionId}]`);
    },
    () => {
      if (onReady) {
        onReady();
      }
    }
  );

  session.sonioxWs = sonioxWs;
  sonioxSessions.set(sessionId, session);

  console.log(`Soniox 세션 생성: ${sessionId}, chatId: ${session.currentChatId}`);
  return session;
}

export function writeAudioToSonioxSession(
  sessionId: string,
  audioData: Buffer
): boolean {
  const session = sonioxSessions.get(sessionId);

  if (!session || !session.isActive || !session.sonioxWs) {
    console.warn(`유효하지 않은 Soniox 세션: ${sessionId}`);
    return false;
  }

  if (session.sonioxWs.readyState !== WebSocket.OPEN) {
    console.warn(`Soniox WebSocket이 열려있지 않음: ${sessionId}`);
    return false;
  }

  try {
    session.sonioxWs.send(audioData);
    return true;
  } catch (error) {
    console.error(`Soniox 오디오 쓰기 실패 [${sessionId}]:`, error);
    return false;
  }
}

export function closeSonioxSession(sessionId: string): void {
  const session = sonioxSessions.get(sessionId);

  if (session) {
    if (session.sonioxWs && session.sonioxWs.readyState === WebSocket.OPEN) {
      session.sonioxWs.send(Buffer.alloc(0));
      session.sonioxWs.close();
    }
    session.isActive = false;
    sonioxSessions.delete(sessionId);
    console.log(`Soniox 세션 종료: ${sessionId}`);
  }
}

export function getChatId(sessionId: string): string {
  return sonioxSessions.get(sessionId)?.currentChatId || '';
}
