import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslationServiceClient } from '@google-cloud/translate';
import { VertexAI } from '@google-cloud/vertexai';
import { TranslationMode, TranslationResult } from './translate.types';

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private translationClient: TranslationServiceClient | null = null;
  private vertexAI: VertexAI | null = null;

  // 1 QPS 큐잉
  private adaptiveQueue: Promise<void> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {}

  async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    mode: TranslationMode,
  ): Promise<TranslationResult> {
    if (mode === 'advanced') {
      return this.enqueueAdaptive(() =>
        this.translateAdvanced(text, sourceLanguageCode, targetLanguageCode),
      );
    }
    return this.translateGemini(text, sourceLanguageCode, targetLanguageCode);
  }

  private enqueueAdaptive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.adaptiveQueue.then(fn);
    this.adaptiveQueue = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  private async translateAdvanced(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
  ): Promise<TranslationResult> {
    const client = this.getTranslationClient();
    const projectId = this.configService.get<string>('google.projectId');
    const parent = `projects/${projectId}/locations/us-central1`;

    const [response] = await client.translateText({
      parent,
      contents: [text],
      mimeType: 'text/plain',
      sourceLanguageCode,
      targetLanguageCode,
      model: `${parent}/models/general/translation-llm`,
    });

    const translatedText = response.translations?.[0]?.translatedText ?? '';
    return { originalText: text, translatedText, timestamp: Date.now() };
  }

  private async translateGemini(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
  ): Promise<TranslationResult> {
    const vertexAI = this.getVertexAI();
    const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const safeSrc = sourceLanguageCode.replace(/[^a-zA-Z-]/g, '');
    const safeTgt = targetLanguageCode.replace(/[^a-zA-Z-]/g, '');

    const prompt = `You are a professional translator.
Translate the following text from ${safeSrc} to ${safeTgt}.
Return only the translated text without any explanation.

Text: ${text}`;

    const result = await model.generateContent(prompt);
    const translatedText =
      result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    return { originalText: text, translatedText, timestamp: Date.now() };
  }

  private getGoogleCredentials() {
    const projectId = this.configService.get<string>('google.projectId');
    const clientEmail = this.configService.get<string>('google.clientEmail');
    const privateKey = this.configService.get<string>('google.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Google Cloud 인증 정보가 설정되지 않았습니다.');
    }

    return { projectId, clientEmail, privateKey };
  }

  private getTranslationClient(): TranslationServiceClient {
    if (!this.translationClient) {
      const { projectId, clientEmail, privateKey } = this.getGoogleCredentials();
      this.translationClient = new TranslationServiceClient({
        projectId,
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
      });
    }
    return this.translationClient;
  }

  private getVertexAI(): VertexAI {
    if (!this.vertexAI) {
      const { projectId, clientEmail, privateKey } = this.getGoogleCredentials();
      this.vertexAI = new VertexAI({
        project: projectId,
        location: 'us-central1',
        googleAuthOptions: {
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
        },
      });
    }
    return this.vertexAI;
  }
}
