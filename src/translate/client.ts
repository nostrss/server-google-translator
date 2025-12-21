import { TranslationServiceClient } from '@google-cloud/translate';
import { config } from '../config';

let translationClient: TranslationServiceClient | null = null;

export function getTranslationClient(): TranslationServiceClient {
  if (!translationClient) {
    translationClient = new TranslationServiceClient({
      projectId: config.google.projectId,
      credentials: config.google.credentials,
    });
    console.log('Google Cloud Translation 클라이언트 초기화 완료');
  }
  return translationClient;
}
