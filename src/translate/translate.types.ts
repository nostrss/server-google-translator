export type TranslationMode =
  | 'gemini-flash-lite'
  | 'gemma-3n'
  | 'gpt-4.1-nano'
  | 'gpt-4.1-mini'
  | 'claude-haiku'
  | 'claude-sonnet'
  | 'gemini-flash'
  | 'mistral-small'
  | 'gemini-3-flash'
  | 'gpt-5-nano'
  | 'llama-3.3-70b';

export const TRANSLATION_MODES: TranslationMode[] = [
  'gemini-flash-lite',
  'gemma-3n',
  'gpt-4.1-nano',
  'gpt-4.1-mini',
  'claude-haiku',
  'claude-sonnet',
  'gemini-flash',
  'mistral-small',
  'gemini-3-flash',
  'gpt-5-nano',
  'llama-3.3-70b',
];

export const FREE_MODES: TranslationMode[] = ['gemma-3n'];

export interface UserApiKeys {
  openrouterKey?: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  timestamp: number;
}
