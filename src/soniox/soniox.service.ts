import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SonioxNodeClient } from '@soniox/node';
import type { RealtimeResult } from '@soniox/node';
import { SonioxSession } from './soniox.types';

const VAD_TIMEOUT_MS = 30_000;
const SESSION_MAX_DURATION_MS = 30 * 60 * 1000;
const VAD_CHECK_INTERVAL_MS = 5_000;

export type SonioxResultCallback = (
  transcript: string,
  translatedText: string | undefined,
  isFinal: boolean,
  segmentId: string,
  detectedLanguage: string,
) => void;

@Injectable()
export class SonioxService {
  private readonly logger = new Logger(SonioxService.name);
  private readonly sessions = new Map<string, SonioxSession>();
  private client: SonioxNodeClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): SonioxNodeClient {
    if (!this.client) {
      const apiKey = this.configService.get<string>('soniox.apiKey');
      if (!apiKey) throw new Error('SONIOX_API_KEY가 설정되지 않았습니다.');
      this.client = new SonioxNodeClient({ api_key: apiKey });
    }
    return this.client;
  }

  async createSession(
    sessionId: string,
    languageHints: string[],
    targetLanguage: string | undefined,
    onResult: SonioxResultCallback,
    onReady: () => void,
    onEndpoint: (finalTranscript: string, segmentId: string, detectedLanguage: string) => void,
    onVadTimeout: () => void,
    onSessionTimeout: () => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    const client = this.getClient();

    const state = { accumulatedOriginal: '', accumulatedTranslation: '', segmentIndex: 0, detectedLanguage: '' };

    const getSegmentId = () => `${sessionId}-${state.segmentIndex}`;

    const session = client.realtime.stt({
      model: 'stt-rt-v4',
      audio_format: 'pcm_s16le',
      sample_rate: 16000,
      num_channels: 1,
      language_hints: languageHints,
      enable_language_identification: true,
      enable_endpoint_detection: true,
      max_endpoint_delay_ms: 1500,
      ...(targetLanguage && {
        translation: {
          type: 'one_way' as const,
          target_language: targetLanguage,
        },
      }),
    });

    session.on('result', (result: RealtimeResult) => {
      if (!result.tokens?.length) return;

      const sonioxSession = this.sessions.get(sessionId);
      if (sonioxSession) sonioxSession.lastTokenAt = Date.now();

      let nonFinalOriginal = '';
      let nonFinalTranslation = '';

      for (const token of result.tokens) {
        if (token.translation_status === 'translation') {
          if (token.is_final) {
            state.accumulatedTranslation += token.text;
          } else {
            nonFinalTranslation += token.text;
          }
        } else {
          if (token.is_final) {
            state.accumulatedOriginal += token.text;
          } else {
            nonFinalOriginal += token.text;
          }
          if ((token as any).language) {
            state.detectedLanguage = (token as any).language;
          }
        }
      }

      const currentOriginal = state.accumulatedOriginal + nonFinalOriginal;
      const currentTranslation = state.accumulatedTranslation + nonFinalTranslation;
      const translatedText = targetLanguage
        ? currentTranslation || undefined
        : undefined;
      onResult(currentOriginal, translatedText, false, getSegmentId(), state.detectedLanguage);
    });

    session.on('endpoint', () => {
      const finalTranscript = state.accumulatedOriginal.trim();
      const segmentId = getSegmentId();
      const detectedLanguage = state.detectedLanguage;
      state.accumulatedOriginal = '';
      state.accumulatedTranslation = '';
      state.segmentIndex++;
      state.detectedLanguage = '';
      onEndpoint(finalTranscript, segmentId, detectedLanguage);
    });

    session.on('error', (error: Error) => {
      this.logger.error(`Soniox 에러 [${sessionId}]:`, error.message);
      this.closeSession(sessionId);
      onError(error);
    });

    session.on('disconnected', () => {
      this.closeSession(sessionId);
    });

    try {
      await session.connect();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const vadTimer = setInterval(() => {
      try {
        const s = this.sessions.get(sessionId);
        if (s && Date.now() - s.lastTokenAt > VAD_TIMEOUT_MS) {
          this.closeSession(sessionId);
          onVadTimeout();
        }
      } catch (err) {
        this.logger.error(`VAD 타이머 에러 [${sessionId}]:`, err);
        this.closeSession(sessionId);
      }
    }, VAD_CHECK_INTERVAL_MS);

    const sessionTimer = setTimeout(() => {
      try {
        this.closeSession(sessionId);
        onSessionTimeout();
      } catch (err) {
        this.logger.error(`세션 타이머 에러 [${sessionId}]:`, err);
        this.closeSession(sessionId);
      }
    }, SESSION_MAX_DURATION_MS);

    this.sessions.set(sessionId, {
      session,
      vadTimer,
      sessionTimer,
      lastTokenAt: Date.now(),
      isActive: true,
      state,
    });

    onReady();
  }

  writeAudio(sessionId: string, audioBuffer: Buffer): void {
    const s = this.sessions.get(sessionId);
    if (!s?.isActive || s.session.state !== 'connected') return;
    s.session.sendAudio(audioBuffer);
  }

  flushAndClose(sessionId: string): { remaining: string; segmentId: string; detectedLanguage: string } | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const remaining = s.state.accumulatedOriginal.trim();
    const segmentId = `${sessionId}-${s.state.segmentIndex}`;
    const detectedLanguage = s.state.detectedLanguage;
    this.closeSession(sessionId);
    return remaining ? { remaining, segmentId, detectedLanguage } : null;
  }

  closeSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;

    s.isActive = false;
    this.sessions.delete(sessionId);

    if (s.vadTimer) clearInterval(s.vadTimer);
    clearTimeout(s.sessionTimer);

    if (s.session.state === 'connected') {
      s.session.close();
    }
  }
}
