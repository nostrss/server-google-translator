import { Duplex } from 'stream';
import { getSpeechClient, getRecognizerPath } from './client';
import { config } from '../config';
import { CircularBuffer } from './circular-buffer';
import {
  SpeechSession,
  speechSessions,
  SpeechResultCallback,
  SpeechErrorCallback,
  TranslationRequestCallback,
  StreamingRecognizeResponseV2,
  STREAM_RESTART_CONSTANTS,
} from './types';

/**
 * 스트림 재시작 타이머 설정
 */
function scheduleStreamRestart(sessionId: string): void {
  const session = speechSessions.get(sessionId);
  if (!session) return;

  // 기존 타이머 정리
  if (session.restartTimer) {
    clearTimeout(session.restartTimer);
  }

  session.restartTimer = setTimeout(() => {
    initiateStreamRestart(sessionId);
  }, STREAM_RESTART_CONSTANTS.RESTART_THRESHOLD_MS);
}

/**
 * 스트림 재시작 실행
 */
async function initiateStreamRestart(sessionId: string): Promise<void> {
  const session = speechSessions.get(sessionId);
  if (!session || !session.isActive) return;

  console.log(`[${sessionId}] 스트림 재시작 시작 (4분 30초 경과)`);

  // 재시작 전에 축적된 텍스트를 isFinal=true로 번역 요청
  const pendingText = session.currentTranscript.trim();
  if (pendingText && session.onTranslationRequest) {
    console.log(`[${sessionId}] 재시작 전 축적된 텍스트 번역 요청: "${pendingText}"`);
    session.currentTranscript = '';
    // 번역 요청 (비동기로 진행, 재시작을 블로킹하지 않음)
    session.onTranslationRequest(pendingText, true).catch((error) => {
      console.error(`[${sessionId}] 재시작 전 번역 요청 실패:`, error);
    });
  }
  session.isTransitioning = true;

  const client = getSpeechClient();
  const newGeneration = session.streamGeneration + 1;

  // 새 스트림 생성
  const newStream = createRecognizeStream(
    client,
    sessionId,
    newGeneration,
    session.onResult
  );

  // 새 스트림에 config 전송
  const configRequest = {
    recognizer: getRecognizerPath(),
    streamingConfig: {
      config: {
        explicitDecodingConfig: {
          encoding: 'LINEAR16' as const,
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
  newStream.write(configRequest);

  // 버퍼된 오디오 데이터 전송 (연속성 보장, 청크 분할)
  const bufferedAudio = session.audioBuffer.getAll();
  if (bufferedAudio.length > 0) {
    const maxChunkSize = STREAM_RESTART_CONSTANTS.MAX_AUDIO_CHUNK_SIZE;
    for (let i = 0; i < bufferedAudio.length; i += maxChunkSize) {
      const chunk = bufferedAudio.subarray(i, Math.min(i + maxChunkSize, bufferedAudio.length));
      newStream.write({ audio: chunk });
    }
    console.log(`[${sessionId}] 버퍼 데이터 전송: ${bufferedAudio.length} bytes (${Math.ceil(bufferedAudio.length / maxChunkSize)} 청크)`);
  }

  // 스트림 전환
  const oldStream = session.recognizeStream;
  session.recognizeStream = newStream;
  session.streamGeneration = newGeneration;
  session.configSent = true;
  session.streamStartTime = Date.now();
  session.isTransitioning = false;

  // 기존 스트림 정리
  if (oldStream) {
    oldStream.end();
  }

  // 새 타이머 설정
  scheduleStreamRestart(sessionId);

  console.log(`[${sessionId}] 스트림 재시작 완료 (generation: ${newGeneration})`);
}

/**
 * 스트림 데이터 핸들러
 */
function handleStreamData(
  sessionId: string,
  generation: number,
  data: StreamingRecognizeResponseV2,
  onResult?: SpeechResultCallback
): void {
  const session = speechSessions.get(sessionId);
  if (!session) return;

  // 이전 세대 스트림의 결과는 무시 (전환 중 중복 방지)
  if (generation < session.streamGeneration) {
    return;
  }

  if (data.results && data.results.length > 0) {
    const result = data.results[0];
    if (result?.alternatives?.[0]?.transcript) {
      const transcript = result.alternatives[0].transcript;
      const isFinal = result.isFinal ?? false;
      console.log(`[${sessionId}] ${isFinal ? '최종' : '중간'}: ${transcript}`);

      // 텍스트 축적: interim은 저장, final은 초기화
      if (isFinal) {
        session.currentTranscript = '';
      } else {
        session.currentTranscript = transcript;
      }

      if (onResult) {
        onResult(transcript, isFinal);
      }
    }
  }
}

/**
 * 스트림 에러 핸들러
 */
function handleStreamError(
  sessionId: string,
  generation: number,
  error: Error
): void {
  const session = speechSessions.get(sessionId);
  if (!session) return;

  // 전환 중이거나 이전 세대 스트림의 에러는 무시
  if (session.isTransitioning || generation < session.streamGeneration) {
    console.log(`[${sessionId}] 이전 스트림 에러 무시`);
    return;
  }

  // 5분 제한 관련 에러시 재시작 시도
  if (
    error.message.includes('Max duration') ||
    error.message.includes('maximum allowed') ||
    error.message.includes('stream duration') ||
    error.message.includes('ABORTED')
  ) {
    console.log(`[${sessionId}] 스트림 제한 에러로 인한 재시작 시도`);
    initiateStreamRestart(sessionId);
    return;
  }

  // 그 외 에러는 세션 종료 및 클라이언트 알림
  console.error(`STT 에러 [${sessionId}]:`, error.message);

  // 클라이언트에 에러 알림
  if (session.onError) {
    session.onError(error.message);
  }

  closeSpeechSession(sessionId);
}

/**
 * Recognize 스트림 생성 헬퍼
 */
function createRecognizeStream(
  client: ReturnType<typeof getSpeechClient>,
  sessionId: string,
  generation: number,
  onResult?: SpeechResultCallback
): Duplex {
  return client
    ._streamingRecognize()
    .on('error', (error: Error) => {
      handleStreamError(sessionId, generation, error);
    })
    .on('data', (data: StreamingRecognizeResponseV2) => {
      handleStreamData(sessionId, generation, data, onResult);
    })
    .on('end', () => {
      console.log(`STT 스트림 종료 [${sessionId}][gen:${generation}]`);
    });
}

export function createSpeechSession(
  sessionId: string,
  languageCode?: string,
  onResult?: SpeechResultCallback,
  onError?: SpeechErrorCallback,
  sourceLanguageCode?: string,
  targetLanguageCode?: string,
  onTranslationRequest?: TranslationRequestCallback
): SpeechSession {
  const client = getSpeechClient();
  const effectiveLanguageCode = languageCode || config.speech.languageCode;

  // 링 버퍼 생성 (1.5초 분량)
  const bufferSize = Math.ceil(
    (STREAM_RESTART_CONSTANTS.AUDIO_BUFFER_DURATION_MS / 1000) *
      STREAM_RESTART_CONSTANTS.AUDIO_BYTES_PER_SECOND
  );
  const audioBuffer = new CircularBuffer(bufferSize);

  const recognizeStream = createRecognizeStream(client, sessionId, 0, onResult);

  const session: SpeechSession = {
    sessionId,
    recognizeStream,
    isActive: true,
    createdAt: Date.now(),
    streamStartTime: Date.now(),
    config: {
      languageCodes: [effectiveLanguageCode],
      model: config.speech.model,
    },
    configSent: false,
    restartTimer: null,
    audioBuffer,
    onResult,
    onError,
    onTranslationRequest,
    isTransitioning: false,
    streamGeneration: 0,
    currentTranscript: '',
    sourceLanguageCode: sourceLanguageCode || effectiveLanguageCode,
    targetLanguageCode,
  };

  speechSessions.set(sessionId, session);

  // 4분 30초 후 재시작 타이머 설정
  scheduleStreamRestart(sessionId);

  console.log(`STT 세션 생성: ${sessionId} (Chirp 3 모델, 자동 재시작 활성화)`);

  return session;
}

export function writeAudioToSession(sessionId: string, audioData: Buffer): boolean {
  const session = speechSessions.get(sessionId);

  if (!session || !session.isActive || !session.recognizeStream) {
    console.warn(`유효하지 않은 STT 세션: ${sessionId}`);
    return false;
  }

  try {
    // 오디오 버퍼에 저장 (재시작 시 사용)
    session.audioBuffer.write(audioData);

    if (!session.configSent) {
      const configRequest = {
        recognizer: getRecognizerPath(),
        streamingConfig: {
          config: {
            explicitDecodingConfig: {
              encoding: 'LINEAR16' as const,
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

/**
 * 축적된 interim 텍스트를 isFinal=true로 번역 요청
 */
export async function flushPendingTranscript(sessionId: string): Promise<void> {
  const session = speechSessions.get(sessionId);

  if (!session) return;

  const pendingText = session.currentTranscript.trim();
  if (!pendingText) return;

  console.log(`[${sessionId}] 축적된 텍스트 플러시: "${pendingText}"`);

  // 축적된 텍스트 초기화
  session.currentTranscript = '';

  // onTranslationRequest 콜백이 있으면 isFinal=true로 번역 요청
  if (session.onTranslationRequest) {
    await session.onTranslationRequest(pendingText, true);
  }
}

export function closeSpeechSession(sessionId: string): void {
  const session = speechSessions.get(sessionId);

  if (session) {
    // 재시작 타이머 정리
    if (session.restartTimer) {
      clearTimeout(session.restartTimer);
      session.restartTimer = null;
    }

    // 현재 스트림 정리
    if (session.recognizeStream) {
      session.recognizeStream.end();
    }

    session.isActive = false;
    speechSessions.delete(sessionId);
    console.log(`STT 세션 종료: ${sessionId}`);
  }
}
