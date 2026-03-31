import { Module } from '@nestjs/common';
import { SpeechGateway } from './speech.gateway';
import { SonioxModule } from '../soniox/soniox.module';
import { TranslateModule } from '../translate/translate.module';

@Module({
  imports: [SonioxModule, TranslateModule],
  providers: [SpeechGateway],
})
export class SpeechModule {}
