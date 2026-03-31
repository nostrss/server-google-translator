import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslationServiceClient } from '@google-cloud/translate';
import { Language, STT_LANGUAGES } from './data/stt-languages';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LanguagesService {
  private readonly logger = new Logger(LanguagesService.name);
  private translationClient: TranslationServiceClient | null = null;
  private translationLanguagesCache: Language[] | null = null;
  private cacheExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {}

  getSttLanguages(query?: string): Language[] {
    if (!query) return STT_LANGUAGES;
    const q = query.toLowerCase();
    return STT_LANGUAGES.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q),
    );
  }

  async getTranslationLanguages(query?: string): Promise<Language[]> {
    const languages = await this.fetchTranslationLanguages();
    if (!query) return languages;
    const q = query.toLowerCase();
    return languages.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q),
    );
  }

  private async fetchTranslationLanguages(): Promise<Language[]> {
    if (this.translationLanguagesCache && Date.now() < this.cacheExpiresAt) {
      return this.translationLanguagesCache;
    }

    try {
      const client = this.getTranslationClient();
      const projectId = this.configService.get<string>('google.projectId');
      const [response] = await client.getSupportedLanguages({
        parent: `projects/${projectId}/locations/global`,
        displayLanguageCode: 'en',
      });

      const languages: Language[] = (response.languages ?? []).map((l) => ({
        code: l.languageCode ?? '',
        name: l.displayName ?? l.languageCode ?? '',
        nativeName: l.displayName ?? l.languageCode ?? '',
      }));

      this.translationLanguagesCache = languages;
      this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return languages;
    } catch (err) {
      this.logger.error('Google Translate 언어 목록 조회 실패:', err);
      return [];
    }
  }

  private getTranslationClient(): TranslationServiceClient {
    if (!this.translationClient) {
      this.translationClient = new TranslationServiceClient({
        projectId: this.configService.get<string>('google.projectId'),
        credentials: {
          client_email: this.configService.get<string>('google.clientEmail'),
          private_key: this.configService.get<string>('google.privateKey'),
        },
      });
    }
    return this.translationClient;
  }
}
