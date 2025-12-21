import { getSpeechClient } from './client';
import { config } from '../config';
import { SpeechSession, speechSessions, SpeechResultCallback } from './types';

export function createSpeechSession(
  sessionId: string,
  languageCode?: string,
  onResult?: SpeechResultCallback
): SpeechSession {
  const client = getSpeechClient();
  const effectiveLanguageCode = languageCode || config.speech.languageCode;

  const request = {
    config: {
      encoding: config.speech.encoding,
      sampleRateHertz: config.speech.sampleRateHertz,
      languageCode: effectiveLanguageCode,
    },
    interimResults: config.speech.interimResults,
  };

  const recognizeStream = client
    .streamingRecognize(request)
    .on('error', (error) => {
      console.error(`STT 에러 [${sessionId}]:`, error.message);
      closeSpeechSession(sessionId);
    })
    .on('data', (data) => {
      const result = data.results[0];
      if (result?.alternatives[0]) {
        const transcript = result.alternatives[0].transcript;
        const isFinal = result.isFinal;
        console.log(`[${sessionId}] ${isFinal ? '최종' : '중간'}: ${transcript}`);
        if (onResult) {
          onResult(transcript, isFinal);
        }
      }
    })
    .on('end', () => {
      console.log(`STT 스트림 종료 [${sessionId}]`);
    });

  const session: SpeechSession = {
    sessionId,
    recognizeStream,
    isActive: true,
    createdAt: Date.now(),
    config: {
      encoding: config.speech.encoding,
      sampleRateHertz: config.speech.sampleRateHertz,
      languageCode: effectiveLanguageCode,
    },
  };

  speechSessions.set(sessionId, session);
  console.log(`STT 세션 생성: ${sessionId}`);

  return session;
}

export function writeAudioToSession(sessionId: string, audioData: Buffer): boolean {
  const session = speechSessions.get(sessionId);

  if (!session || !session.isActive || !session.recognizeStream) {
    console.warn(`유효하지 않은 STT 세션: ${sessionId}`);
    return false;
  }

  try {
    session.recognizeStream.write(audioData);
    return true;
  } catch (error) {
    console.error(`오디오 쓰기 실패 [${sessionId}]:`, error);
    return false;
  }
}

export function closeSpeechSession(sessionId: string): void {
  const session = speechSessions.get(sessionId);

  if (session) {
    if (session.recognizeStream) {
      session.recognizeStream.end();
    }
    session.isActive = false;
    speechSessions.delete(sessionId);
    console.log(`STT 세션 종료: ${sessionId}`);
  }
}
