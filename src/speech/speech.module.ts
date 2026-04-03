import { Module } from '@nestjs/common';
import { SpeechGateway } from './speech.gateway';
import { SonioxModule } from '../soniox/soniox.module';
import { TranslateModule } from '../translate/translate.module';
import { SentenceModule } from '../sentence/sentence.module';

@Module({
  imports: [SonioxModule, TranslateModule, SentenceModule],
  providers: [SpeechGateway],
})
export class SpeechModule {}
