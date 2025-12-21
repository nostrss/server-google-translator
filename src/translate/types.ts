export type TranslationModel = 'nmt' | 'llm';

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  isFinal: boolean;
  model: TranslationModel;
  timestamp: number;
}

export interface TranslationConfig {
  sourceLanguageCode: string;
  targetLanguageCode: string;
}
