import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength, Matches, ValidateNested } from 'class-validator';
import { TranslationMode, TRANSLATION_MODES } from '../../translate/translate.types';

const MAX_API_KEY_LENGTH = 256;

class UserApiKeysDto {
  @IsString()
  @IsOptional()
  @MaxLength(MAX_API_KEY_LENGTH)
  @Matches(/^[\x20-\x7E]+$/, { message: 'API key contains invalid characters' })
  openrouterKey?: string;
}

export class StartSpeechDto {
  @IsString()
  @IsOptional()
  languageCode?: string;

  @IsString()
  @IsOptional()
  targetLanguageCode?: string;

  @IsEnum(TRANSLATION_MODES)
  @IsOptional()
  translationMode?: TranslationMode = 'gemma-3n';

  @IsNumber()
  @IsOptional()
  sampleRateHertz?: number = 16000;

  @IsObject()
  @ValidateNested()
  @Type(() => UserApiKeysDto)
  @IsOptional()
  apiKeys?: UserApiKeysDto;
}
