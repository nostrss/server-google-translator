import { getSpeechClient, getRecognizerPath } from './client';
import { config } from '../config';
import {
  SpeechSession,
  speechSessions,
  SpeechResultCallback,
  StreamingRecognizeResponseV2,
} from './types';

export function createSpeechSession(
  sessionId: string,
  languageCode?: string,
  onResult?: SpeechResultCallback
): SpeechSession {
  const client = getSpeechClient();
  const effectiveLanguageCode = languageCode || config.speech.languageCode;

  const recognizeStream = client
    ._streamingRecognize()
    .on('error', (error: Error) => {
      console.error(`STT 에러 [${sessionId}]:`, error.message);
      closeSpeechSession(sessionId);
    })
    .on('data', (data: StreamingRecognizeResponseV2) => {
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result?.alternatives?.[0]?.transcript) {
          const transcript = result.alternatives[0].transcript;
          const isFinal = result.isFinal ?? false;
          console.log(`[${sessionId}] ${isFinal ? '최종' : '중간'}: ${transcript}`);
          if (onResult) {
            onResult(transcript, isFinal);
          }
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
      languageCodes: [effectiveLanguageCode],
      model: config.speech.model,
    },
    configSent: false,
  };

  speechSessions.set(sessionId, session);
  console.log(`STT 세션 생성: ${sessionId} (Chirp 3 모델)`);

  return session;
}

export function writeAudioToSession(sessionId: string, audioData: Buffer): boolean {
  const session = speechSessions.get(sessionId);

  if (!session || !session.isActive || !session.recognizeStream) {
    console.warn(`유효하지 않은 STT 세션: ${sessionId}`);
    return false;
  }

  try {
    if (!session.configSent) {
      const configRequest = {
        recognizer: getRecognizerPath(),
        streamingConfig: {
          config: {
            explicitDecodingConfig: {
              encoding: 'LINEAR16',
              sampleRateHertz: 16000,
              audioChannelCount: 1,
            },
            languageCodes: session.config.languageCodes,
            model: session.config.model,
            features: {
              enableAutomaticPunctuation: true,
            },
          },
          streamingFeatures: {
            interimResults: config.speech.interimResults,
          },
        },
      };
      session.recognizeStream.write(configRequest);
      session.configSent = true;
      console.log(`[${sessionId}] V2 Config 전송 완료`);
    }

    session.recognizeStream.write({ audio: audioData });
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
