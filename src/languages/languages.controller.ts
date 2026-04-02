import { Controller, Get, Query } from '@nestjs/common';
import { LanguagesService } from './languages.service';

@Controller('api/languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get('translation')
  getTranslationLanguages(@Query('q') query?: string) {
    return { languages: this.languagesService.getTranslationLanguages(query) };
  }
}
