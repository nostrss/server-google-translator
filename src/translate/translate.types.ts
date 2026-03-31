export type TranslationMode = 'advanced' | 'standard';

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  timestamp: number;
}
