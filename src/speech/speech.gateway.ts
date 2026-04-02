import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'ws';
import WebSocket from 'ws';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SonioxService } from '../soniox/soniox.service';
import { TranslateService } from '../translate/translate.service';
import { SentenceService } from '../sentence/sentence.service';
import { stripWavHeader, extractLangCode } from '../common/audio.utils';
import { ErrorCode } from '../common/constants/error-codes';
import { StartSpeechDto } from './dto/start-speech.dto';
import {
  ClientEvents,
  ClientMessage,
  ServerEvents,
  ServerMessage,
  StartSpeechRequestData,
  AudioChunkData,
  ConnectedResponseData,
  SpeechResultResponseData,
  TranslationResultResponseData,
} from './speech.types';
import { TranslationMode, UserApiKeys, FREE_MODES } from '../translate/translate.types';
import { TranslationApiError } from '../translate/translate.error';
import { ConfigService } from '@nestjs/config';

const MAX_AUDIO_CHUNK_BYTES = 64 * 1024;
const MAX_SESSIONS_PER_IP = 3;
const TRANSLATION_TIMEOUT_MS = 30_000;
const SENTENCE_SPLIT_MIN_LENGTH = 20;
const SENTENCE_SPLIT_DEBOUNCE_MS = 300;

@WebSocketGateway({ path: '/' })
export class SpeechGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SpeechGateway.name);

  @WebSocketServer()
  server!: Server;

  private readonly wsToSessionId = new Map<WebSocket, string>();
  private readonly ipSessionCount = new Map<string, number>();
  private readonly sessionTranslateConfig = new Map<string, {
    sourceCode: string;
    targetCode: string;
    translationMode: TranslationMode;
    translateEnabled: boolean;
    apiKeys?: UserApiKeys;
  }>();
  private readonly lastSplitRequestAt = new Map<string, number>();

  constructor(
    private readonly sonioxService: SonioxService,
    private readonly translateService: TranslateService,
    private readonly sentenceService: SentenceService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: WebSocket, req: import('http').IncomingMessage): void {
    const origin = req.headers.origin ?? '';
    const allowedOrigins = this.configService.get<string[]>('security.allowedOrigins') ?? [];

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      this.sendError(client, ErrorCode.ORIGIN_REJECTED, '허가되지 않은 접속입니다.');
      client.close();
      return;
    }

    const ip = req.socket.remoteAddress ?? 'unknown';
    const count = this.ipSessionCount.get(ip) ?? 0;
    if (count >= MAX_SESSIONS_PER_IP) {
      this.sendError(client, ErrorCode.TOO_MANY_SESSIONS, '동시 세션 한도를 초과했습니다.');
      client.close();
      return;
    }
    this.ipSessionCount.set(ip, count + 1);

    client.on('message', (raw: Buffer) => this.handleMessage(client, raw));
    client.on('close', () => {
      // 세션 정리
      const sessionId = this.wsToSessionId.get(client);
      if (sessionId) {
        this.sonioxService.closeSession(sessionId);
        this.wsToSessionId.delete(client);
        this.sessionTranslateConfig.delete(sessionId);
        this.lastSplitRequestAt.delete(sessionId);
      }
      // IP 카운터 감소
      const currentCount = this.ipSessionCount.get(ip) ?? 0;
      const newCount = Math.max(0, currentCount - 1);
      if (newCount === 0) {
        this.ipSessionCount.delete(ip);
      } else {
        this.ipSessionCount.set(ip, newCount);
      }
    });
  }

  handleDisconnect(client: WebSocket): void {
    const sessionId = this.wsToSessionId.get(client);
    if (sessionId) {
      this.sonioxService.closeSession(sessionId);
      this.wsToSessionId.delete(client);
      this.sessionTranslateConfig.delete(sessionId);
      this.lastSplitRequestAt.delete(sessionId);
    }
  }

  private handleMessage(client: WebSocket, raw: Buffer): void {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString()) as ClientMessage;
    } catch (err) {
      this.logger.debug(`메시지 파싱 에러: ${err}`);
      this.sendError(client, ErrorCode.INVALID_MESSAGE, '잘못된 메시지 형식입니다.');
      return;
    }

    switch (message.event) {
      case ClientEvents.CONNECT:
        this.onConnect(client);
        break;
      case ClientEvents.START_SPEECH:
        this.onStartSpeech(client, message as ClientMessage<StartSpeechRequestData>)
          .catch((err: unknown) => {
            this.logger.error('start_speech 처리 에러:', err instanceof Error ? err.message : 'unknown');
            this.sendError(client, ErrorCode.INTERNAL_ERROR, '음성 인식 시작 중 오류가 발생했습니다.');
          });
        break;
      case ClientEvents.AUDIO_CHUNK:
        this.onAudioChunk(client, message as ClientMessage<AudioChunkData>);
        break;
      case ClientEvents.STOP_SPEECH:
        this.onStopSpeech(client);
        break;
      default: {
        const safeEvent = String(message.event).substring(0, 50);
        this.sendError(client, ErrorCode.UNKNOWN_EVENT, `알 수 없는 이벤트: ${safeEvent}`);
      }
    }
  }

  private onConnect(client: WebSocket): void {
    const sessionId = crypto.randomUUID();
    this.wsToSessionId.set(client, sessionId);
    this.send<ConnectedResponseData>(client, {
      event: ServerEvents.CONNECTED,
      data: { sessionId, message: '연결이 정상적으로 완료되었습니다.', timestamp: Date.now() },
      success: true,
    });
    this.logger.log(`클라이언트 연결: ${sessionId}`);
  }

  private async onStartSpeech(
    client: WebSocket,
    message: ClientMessage<StartSpeechRequestData>,
  ): Promise<void> {
    const sessionId = this.wsToSessionId.get(client);
    if (!sessionId) {
      this.sendError(client, ErrorCode.SESSION_NOT_FOUND, '먼저 connect 이벤트를 보내주세요.');
      return;
    }

    const dto = plainToInstance(StartSpeechDto, message.data ?? {});
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.sendError(client, ErrorCode.INVALID_MESSAGE, '잘못된 start_speech 데이터입니다.');
      return;
    }

    const sourceCode = extractLangCode(dto.languageCode);
    const targetCode = extractLangCode(dto.targetLanguageCode);
    const translateEnabled = !!targetCode && (!sourceCode || sourceCode !== targetCode);
    const translationMode: TranslationMode = dto.translationMode ?? 'gemini-flash-lite';
    const apiKeys = dto.apiKeys;

    // 유료 모델인데 API 키가 없으면 에러
    if (translateEnabled && !FREE_MODES.includes(translationMode) && !apiKeys) {
      this.sendError(client, ErrorCode.API_KEY_REQUIRED, '해당 번역 모델을 사용하려면 API 키가 필요합니다.');
      return;
    }

    // stop_speech 시 번역에 필요한 정보를 클로저로 보관
    this.sessionTranslateConfig.set(sessionId, {
      sourceCode, targetCode, translationMode, translateEnabled, apiKeys,
    });

    const languageHints = sourceCode ? [sourceCode] : [];

    await this.sonioxService.createSession(
      sessionId,
      languageHints,
      translateEnabled ? targetCode : undefined,
      (transcript, translatedText, isFinal, segmentId, detectedLanguage) => {
        this.send<SpeechResultResponseData>(client, {
          event: ServerEvents.SPEECH_RESULT,
          data: { transcript, isFinal, timestamp: Date.now(), segmentId, detectedLanguage: detectedLanguage || undefined },
          success: true,
        });
        if (translateEnabled && translatedText) {
          this.send<TranslationResultResponseData>(client, {
            event: ServerEvents.TRANSLATION_RESULT,
            data: {
              originalText: transcript,
              translatedText,
              isFinal: false,
              timestamp: Date.now(),
              segmentId,
            },
            success: true,
          });
        }
        // 문장 분리 체크
        this.trySplitSentences(client, sessionId, sourceCode, detectedLanguage, targetCode, translationMode, translateEnabled, apiKeys);
      },
      () => {
        this.send(client, {
          event: ServerEvents.SPEECH_STARTED,
          data: { message: '음성 인식이 시작되었습니다.' },
          success: true,
        });
      },
      (finalTranscript, segmentId, detectedLanguage) => {
        this.send<SpeechResultResponseData>(client, {
          event: ServerEvents.SPEECH_RESULT,
          data: { transcript: finalTranscript, isFinal: true, timestamp: Date.now(), segmentId, detectedLanguage: detectedLanguage || undefined },
          success: true,
        });
        if (translateEnabled && finalTranscript.trim()) {
          const effectiveSourceCode = sourceCode || detectedLanguage;
          if (effectiveSourceCode === targetCode) return;
          this.translateWithTimeout(finalTranscript, effectiveSourceCode, targetCode, translationMode, apiKeys)
            .then((result) => {
              if (client.readyState === WebSocket.OPEN) {
                this.send<TranslationResultResponseData>(client, {
                  event: ServerEvents.TRANSLATION_RESULT,
                  data: { ...result, isFinal: true, segmentId },
                  success: true,
                });
              }
            })
            .catch((err: unknown) => this.handleTranslationError(client, err));
        }
      },
      () => {
        this.sendError(client, ErrorCode.VAD_TIMEOUT, '무음이 감지되어 세션이 종료되었습니다.');
        client.close();
      },
      () => {
        this.sendError(client, ErrorCode.SESSION_TIMEOUT, '최대 세션 시간(30분)이 초과되었습니다.');
        client.close();
      },
      (error) => {
        this.sendError(client, ErrorCode.STT_ERROR, `음성 인식 오류: ${error.message}`);
        client.close();
      },
    );
  }

  private async translateWithTimeout(
    text: string,
    sourceCode: string,
    targetCode: string,
    mode: TranslationMode,
    apiKeys?: UserApiKeys,
  ) {
    return Promise.race([
      this.translateService.translate(text, sourceCode, targetCode, mode, apiKeys),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('번역 타임아웃')), TRANSLATION_TIMEOUT_MS),
      ),
    ]);
  }

  private onAudioChunk(client: WebSocket, message: ClientMessage<AudioChunkData>): void {
    const sessionId = this.wsToSessionId.get(client);
    if (!sessionId) {
      this.sendError(client, ErrorCode.SESSION_NOT_FOUND, '먼저 connect 이벤트를 보내주세요.');
      return;
    }
    if (!message.data?.audio) return;

    const audioBuffer = Buffer.from(message.data.audio, 'base64');
    if (audioBuffer.byteLength > MAX_AUDIO_CHUNK_BYTES) {
      this.sendError(client, ErrorCode.PAYLOAD_TOO_LARGE, '오디오 청크가 64KB를 초과했습니다.');
      return;
    }

    this.sonioxService.writeAudio(sessionId, stripWavHeader(audioBuffer));
  }

  private onStopSpeech(client: WebSocket): void {
    const sessionId = this.wsToSessionId.get(client);
    if (sessionId) {
      const flushed = this.sonioxService.flushAndClose(sessionId);
      const config = this.sessionTranslateConfig.get(sessionId);
      this.sessionTranslateConfig.delete(sessionId);

      if (flushed) {
        this.send<SpeechResultResponseData>(client, {
          event: ServerEvents.SPEECH_RESULT,
          data: { transcript: flushed.remaining, isFinal: true, timestamp: Date.now(), segmentId: flushed.segmentId, detectedLanguage: flushed.detectedLanguage || undefined },
          success: true,
        });

        if (config?.translateEnabled && flushed.remaining.trim()) {
          const effectiveSourceCode = config.sourceCode || flushed.detectedLanguage;
          if (effectiveSourceCode !== config.targetCode) {
            this.translateWithTimeout(flushed.remaining, effectiveSourceCode, config.targetCode, config.translationMode, config.apiKeys)
              .then((result) => {
                if (client.readyState === WebSocket.OPEN) {
                  this.send<TranslationResultResponseData>(client, {
                    event: ServerEvents.TRANSLATION_RESULT,
                    data: { ...result, isFinal: true, segmentId: flushed.segmentId },
                    success: true,
                  });
                }
              })
              .catch((err: unknown) => this.handleTranslationError(client, err));
          }
        }
      }
    }
    this.send(client, {
      event: ServerEvents.SPEECH_STOPPED,
      data: { message: '음성 인식이 종료되었습니다.' },
      success: true,
    });
  }

  private trySplitSentences(
    client: WebSocket,
    sessionId: string,
    sourceCode: string,
    detectedLanguage: string,
    targetCode: string,
    translationMode: TranslationMode,
    translateEnabled: boolean,
    apiKeys?: UserApiKeys,
  ): void {
    const accumulatedLength = this.sonioxService.getAccumulatedLength(sessionId);
    if (accumulatedLength < SENTENCE_SPLIT_MIN_LENGTH) return;

    const now = Date.now();
    const lastAt = this.lastSplitRequestAt.get(sessionId) ?? 0;
    if (now - lastAt < SENTENCE_SPLIT_DEBOUNCE_MS) return;
    this.lastSplitRequestAt.set(sessionId, now);

    const accumulated = this.sonioxService.getAccumulatedOriginal(sessionId);
    const lang = sourceCode || detectedLanguage;

    this.sentenceService.split(accumulated, lang)
      .then((sentences) => {
        if (sentences.length <= 1) return;

        // 마지막 문장은 미완성일 수 있으므로 제외
        const completeSentences = sentences.slice(0, -1);

        let consumed = 0;
        for (const sentence of completeSentences) {
          const segmentId = this.sonioxService.getCurrentSegmentId(sessionId);
          if (!segmentId) return;

          // accumulated에서 해당 문장의 실제 종료 위치를 찾아 공백까지 포함하여 소비
          const idx = accumulated.indexOf(sentence, consumed);
          if (idx === -1) return;
          const consumeEnd = idx + sentence.length;

          this.sendFinalSentence(client, sentence, segmentId, detectedLanguage, sourceCode, targetCode, translationMode, translateEnabled, apiKeys);
          this.sonioxService.consumeSentences(sessionId, consumeEnd - consumed);
          consumed = consumeEnd;
        }
      })
      .catch((err) => {
        this.logger.debug(`문장 분리 실패: ${err}`);
      });
  }

  private sendFinalSentence(
    client: WebSocket,
    sentence: string,
    segmentId: string,
    detectedLanguage: string,
    sourceCode: string,
    targetCode: string,
    translationMode: TranslationMode,
    translateEnabled: boolean,
    apiKeys?: UserApiKeys,
  ): void {
    this.send<SpeechResultResponseData>(client, {
      event: ServerEvents.SPEECH_RESULT,
      data: { transcript: sentence, isFinal: true, timestamp: Date.now(), segmentId, detectedLanguage: detectedLanguage || undefined },
      success: true,
    });

    if (translateEnabled && sentence.trim()) {
      const effectiveSourceCode = sourceCode || detectedLanguage;
      if (effectiveSourceCode === targetCode) return;
      this.translateWithTimeout(sentence, effectiveSourceCode, targetCode, translationMode, apiKeys)
        .then((result) => {
          if (client.readyState === WebSocket.OPEN) {
            this.send<TranslationResultResponseData>(client, {
              event: ServerEvents.TRANSLATION_RESULT,
              data: { ...result, isFinal: true, segmentId },
              success: true,
            });
          }
        })
        .catch((err: unknown) => this.handleTranslationError(client, err));
    }
  }

  private send<T>(client: WebSocket, message: ServerMessage<T>): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private sendError(client: WebSocket, code: ErrorCode, message: string): void {
    this.send(client, {
      event: ServerEvents.ERROR,
      success: false,
      error: { code, message },
    });
  }

  private handleTranslationError(client: WebSocket, err: unknown): void {
    if (err instanceof TranslationApiError) {
      this.logger.error(`번역 API 에러 [${err.code}]:`, err.message);
      this.sendError(client, err.code, err.message);
    } else {
      this.logger.error('번역 실패:', err instanceof Error ? err.message : 'unknown');
      this.sendError(client, ErrorCode.TRANSLATION_ERROR, 'Translation failed. Please try again.');
    }
  }
}
