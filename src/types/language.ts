export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export interface LanguagesResponse {
  languages: SupportedLanguage[];
  count: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
