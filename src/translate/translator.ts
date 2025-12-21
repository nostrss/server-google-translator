import { getTranslationClient } from './client';
import { config } from '../config';
import { TranslationModel, TranslationResult } from './types';

export async function translateText(
  text: string,
  sourceLanguageCode: string,
  targetLanguageCode: string,
  model: TranslationModel
): Promise<TranslationResult> {
  const client = getTranslationClient();
  const projectId = config.google.projectId;
  const location = config.translation.location;

  const request: {
    parent: string;
    contents: string[];
    mimeType: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
    model?: string;
  } = {
    parent: `projects/${projectId}/locations/${location}`,
    contents: [text],
    mimeType: 'text/plain',
    sourceLanguageCode,
    targetLanguageCode,
  };

  if (model === 'llm') {
    request.model = `projects/${projectId}/locations/${location}/models/general/translation-llm`;
  }

  const [response] = await client.translateText(request);
  const translatedText = response.translations?.[0]?.translatedText || '';

  return {
    originalText: text,
    translatedText,
    isFinal: model === 'llm',
    model,
    timestamp: Date.now(),
  };
}
