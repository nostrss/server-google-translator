import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { TranslationMode } from '../../translate/translate.types';

export class StartSpeechDto {
  @IsString()
  @IsOptional()
  languageCode?: string = 'ko-KR';

  @IsString()
  @IsOptional()
  targetLanguageCode?: string;

  @IsEnum(['advanced', 'standard'])
  @IsOptional()
  translationMode?: TranslationMode = 'standard';

  @IsNumber()
  @IsOptional()
  sampleRateHertz?: number = 16000;
}
