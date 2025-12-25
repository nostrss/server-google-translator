import { WebSocket } from 'ws';
import crypto from 'crypto';
import {
  ClientMessage,
  ServerMessage,
  ClientEvents,
  ServerEvents,
  ConnectRequestData,
  ConnectedResponseData,
  StartSpeechRequestData,
  AudioChunkData,
  SpeechStartedResponseData,
  SpeechStoppedResponseData,
  SpeechResultResponseData,
  TranslationResultResponseData,
} from './types';
import {
  sendMessage,
  getSessionIdByWs,
  stripWavHeader,
  extractLangCode,
} from './utils';
import {
  createSonioxSession,
  writeAudioToSonioxSession,
  closeSonioxSession,
  getChatId,
} from '../soniox';
import { translateText, TranslationModel } from '../translate';

export function handleSonioxMessage(
  ws: WebSocket,
  rawMessage: Buffer,
  clients: Map<string, WebSocket>
): void {
  try {
    const message: ClientMessage = JSON.parse(rawMessage.toString());

    switch (message.event) {
      case ClientEvents.CONNECT:
        handleConnect(ws, message as ClientMessage<ConnectRequestData>, clients);
        break;
      case ClientEvents.START_SPEECH:
        handleStartSpeech(ws, message as ClientMessage<StartSpeechRequestData>, clients);
        break;
      case ClientEvents.AUDIO_CHUNK:
        handleAudioChunk(ws, message as ClientMessage<AudioChunkData>, clients);
        break;
      case ClientEvents.STOP_SPEECH:
        handleStopSpeech(ws, message, clients);
        break;
      default:
        sendMessage(ws, {
          event: ServerEvents.ERROR,
          success: false,
          error: `알 수 없는 이벤트: ${message.event}`,
          requestId: message.requestId,
        });
    }
  } catch {
    sendMessage(ws, {
      event: ServerEvents.ERROR,
      success: false,
      error: '잘못된 메시지 형식입니다.',
    });
  }
}

function handleConnect(
  ws: WebSocket,
  message: ClientMessage<ConnectRequestData>,
  clients: Map<string, WebSocket>
): void {
  const sessionId = crypto.randomUUID();

  clients.set(sessionId, ws);

  const response: ServerMessage<ConnectedResponseData> = {
    event: ServerEvents.CONNECTED,
    data: {
      sessionId,
      message: '연결이 정상적으로 완료되었습니다.',
      timestamp: Date.now(),
    },
    requestId: message.requestId,
    success: true,
  };

  sendMessage(ws, response);
  console.log(`[Soniox] 클라이언트 연결 완료: ${sessionId}`);
}

function handleStartSpeech(
  ws: WebSocket,
  message: ClientMessage<StartSpeechRequestData>,
  clients: Map<string, WebSocket>
): void {
  const sessionId = getSessionIdByWs(ws, clients);

  if (!sessionId) {
    sendMessage(ws, {
      event: ServerEvents.ERROR,
      success: false,
      error: '먼저 연결을 완료해야 합니다.',
      requestId: message.requestId,
    });
    return;
  }

  const languageCode = message.data?.languageCode;
  const sourceLanguageCode = extractLangCode(languageCode);
  const targetLanguageCode = message.data?.targetLanguageCode
    ? extractLangCode(message.data.targetLanguageCode)
    : undefined;

  const languageHints = [sourceLanguageCode];

  createSonioxSession(
    sessionId,
    languageHints,
    // onResult: 중간 결과 → NMT 번역
    async (transcript, isFinal) => {
      const resultMessage: ServerMessage<SpeechResultResponseData> = {
        event: ServerEvents.SPEECH_RESULT,
        data: {
          transcript,
          isFinal,
          timestamp: Date.now(),
        },
        success: true,
      };
      sendMessage(ws, resultMessage);

      if (targetLanguageCode && transcript.trim()) {
        try {
          const chatId = getChatId(sessionId);
          const result = await translateText(
            transcript,
            sourceLanguageCode,
            targetLanguageCode,
            'nmt'
          );

          const translationMessage: ServerMessage<TranslationResultResponseData> = {
            event: ServerEvents.TRANSLATION_RESULT,
            data: {
              chatId,
              originalText: result.originalText,
              translatedText: result.translatedText,
              isFinal: false,
              model: 'nmt',
              timestamp: result.timestamp,
            },
            success: true,
          };
          sendMessage(ws, translationMessage);
        } catch (error) {
          console.error(`[Soniox] NMT 번역 실패 [${sessionId}]:`, error);
          sendMessage(ws, {
            event: ServerEvents.ERROR,
            success: false,
            error: `번역 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
          });
        }
      }
    },
    // onReady: Soniox 연결 완료 후 speech_started 전송
    () => {
      const response: ServerMessage<SpeechStartedResponseData> = {
        event: ServerEvents.SPEECH_STARTED,
        data: {
          message: '음성 인식이 시작되었습니다. (Soniox)',
        },
        requestId: message.requestId,
        success: true,
      };
      sendMessage(ws, response);
    },
    // onEndpoint: <end> 토큰 → LLM 번역
    async (finalTranscript) => {
      const chatId = getChatId(sessionId);

      // 최종 speech_result 전송
      const resultMessage: ServerMessage<SpeechResultResponseData> = {
        event: ServerEvents.SPEECH_RESULT,
        data: {
          transcript: finalTranscript,
          isFinal: true,
          timestamp: Date.now(),
        },
        success: true,
      };
      sendMessage(ws, resultMessage);

      if (targetLanguageCode && finalTranscript.trim()) {
        try {
          const result = await translateText(
            finalTranscript,
            sourceLanguageCode,
            targetLanguageCode,
            'llm'
          );

          const translationMessage: ServerMessage<TranslationResultResponseData> = {
            event: ServerEvents.TRANSLATION_RESULT,
            data: {
              chatId,
              originalText: result.originalText,
              translatedText: result.translatedText,
              isFinal: true,
              model: 'llm',
              timestamp: result.timestamp,
            },
            success: true,
          };
          sendMessage(ws, translationMessage);
        } catch (error) {
          console.error(`[Soniox] LLM 번역 실패 [${sessionId}]:`, error);
          sendMessage(ws, {
            event: ServerEvents.ERROR,
            success: false,
            error: `LLM 번역 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
          });
        }
      }
    }
  );
}

function handleAudioChunk(
  ws: WebSocket,
  message: ClientMessage<AudioChunkData>,
  clients: Map<string, WebSocket>
): void {
  const sessionId = getSessionIdByWs(ws, clients);

  if (!sessionId || !message.data?.audio) {
    return;
  }

  const audioBuffer = Buffer.from(message.data.audio, 'base64');
  const audioData = stripWavHeader(audioBuffer);

  writeAudioToSonioxSession(sessionId, audioData);
}

function handleStopSpeech(
  ws: WebSocket,
  message: ClientMessage,
  clients: Map<string, WebSocket>
): void {
  const sessionId = getSessionIdByWs(ws, clients);

  if (sessionId) {
    closeSonioxSession(sessionId);
  }

  const response: ServerMessage<SpeechStoppedResponseData> = {
    event: ServerEvents.SPEECH_STOPPED,
    data: {
      message: '음성 인식이 종료되었습니다. (Soniox)',
    },
    requestId: message.requestId,
    success: true,
  };

  sendMessage(ws, response);
}
