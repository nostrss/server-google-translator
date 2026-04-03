import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  TranslationMode,
  TranslationResult,
  UserApiKeys,
  FREE_MODES,
} from './translate.types';
import { TranslationApiError } from './translate.error';

const TRANSLATION_PROMPT = (src: string, tgt: string, text: string) =>
  `You are a professional translator. Translate the following text from ${src} to ${tgt}. Return only the translated text without any explanation.\n\nText: ${text}`;

const OPENROUTER_MODEL_MAP: Record<string, string> = {
  'gemini-flash-lite': 'google/gemini-2.5-flash-lite',
  'gemma-3n': 'google/gemma-3n-e4b-it',
  'gpt-4.1-nano': 'openai/gpt-4.1-nano',
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'claude-haiku': 'anthropic/claude-haiku-4.5',
  'claude-sonnet': 'anthropic/claude-sonnet-4.5',
  'gemini-flash': 'google/gemini-2.5-flash',
  'mistral-small': 'mistralai/mistral-small',
  'gemini-3-flash': 'google/gemini-3-flash-preview',
  'gpt-5-nano': 'openai/gpt-5-nano',
  'llama-3.3-70b': 'meta-llama/llama-3.3-70b-instruct',
};

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  constructor(private readonly configService: ConfigService) {}

  async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    mode: TranslationMode,
    apiKeys?: UserApiKeys,
  ): Promise<TranslationResult> {
    try {
      // 무료: gemma-3n → 서버 OpenRouter 키
      if (mode === 'gemma-3n') {
        const serverKey = this.configService.get<string>('openrouter.apiKey');
        if (!serverKey) throw new Error('서버 OpenRouter 키가 설정되지 않았습니다.');
        return await this.translateWithOpenRouter(
          OPENROUTER_MODEL_MAP['gemma-3n'],
          text, sourceLanguageCode, targetLanguageCode, serverKey,
        );
      }

      // 유료: 유저 OpenRouter 키
      if (!apiKeys?.openrouterKey) {
        throw TranslationApiError.fromProviderError(new Error('API_KEY_REQUIRED'));
      }

      const openrouterModelId = OPENROUTER_MODEL_MAP[mode];
      if (!openrouterModelId) {
        throw new Error(`지원하지 않는 번역 모드: ${mode}`);
      }

      return await this.translateWithOpenRouter(
        openrouterModelId,
        text, sourceLanguageCode, targetLanguageCode, apiKeys.openrouterKey,
      );
    } catch (err) {
      if (err instanceof TranslationApiError) throw err;
      this.logger.error('번역 provider 원본 에러:', err);
      throw TranslationApiError.fromProviderError(err);
    }
  }

  private async translateWithOpenRouter(
    modelId: string,
    text: string,
    src: string,
    tgt: string,
    apiKey: string,
  ): Promise<TranslationResult> {
    const openrouter = createOpenRouter({ apiKey });

    const { text: translatedText } = await generateText({
      model: openrouter(modelId),
      prompt: TRANSLATION_PROMPT(src, tgt, text),
    });

    return { originalText: text, translatedText: translatedText.trim(), timestamp: Date.now() };
  }
}
