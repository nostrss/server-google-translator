import { Injectable } from '@nestjs/common';
import { Language, SUPPORTED_LANGUAGES } from './data/supported-languages';

@Injectable()
export class LanguagesService {
  getTranslationLanguages(query?: string): Language[] {
    if (!query) return SUPPORTED_LANGUAGES;
    const q = query.toLowerCase();
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q),
    );
  }
}
