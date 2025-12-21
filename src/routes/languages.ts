import { IncomingMessage, ServerResponse } from 'http';
import { SUPPORTED_LANGUAGES } from '../data/supported-languages';
import { ApiResponse, LanguagesResponse, SupportedLanguage } from '../types/language';

function searchLanguages(query: string): SupportedLanguage[] {
  const lowerQuery = query.toLowerCase();
  return SUPPORTED_LANGUAGES.filter(
    (lang) =>
      lang.code.toLowerCase().includes(lowerQuery) ||
      lang.name.toLowerCase().includes(lowerQuery) ||
      lang.nativeName.toLowerCase().includes(lowerQuery)
  );
}

export function handleLanguagesRoute(
  req: IncomingMessage,
  res: ServerResponse
): void {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const searchQuery = url.searchParams.get('q');

  try {
    let languages: SupportedLanguage[];

    if (searchQuery) {
      languages = searchLanguages(searchQuery);
    } else {
      languages = SUPPORTED_LANGUAGES;
    }

    const response: ApiResponse<LanguagesResponse> = {
      success: true,
      data: {
        languages,
        count: languages.length,
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  } catch (error) {
    const response: ApiResponse<LanguagesResponse> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '언어 목록을 가져오는 데 실패했습니다.',
      },
    };

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }
}
