import { Controller, Get, Query } from '@nestjs/common';
import { LanguagesService } from './languages.service';

@Controller('api/languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get('stt')
  getSttLanguages(@Query('q') query?: string) {
    return { languages: this.languagesService.getSttLanguages(query) };
  }

  @Get('translation')
  async getTranslationLanguages(@Query('q') query?: string) {
    return { languages: await this.languagesService.getTranslationLanguages(query) };
  }
}
