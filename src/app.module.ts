import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { SonioxModule } from './soniox/soniox.module';
import { TranslateModule } from './translate/translate.module';
import { SpeechModule } from './speech/speech.module';
import { LanguagesModule } from './languages/languages.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    TerminusModule,
    SonioxModule,
    TranslateModule,
    SpeechModule,
    LanguagesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
