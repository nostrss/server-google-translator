import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SentenceService } from './sentence.service';

@Module({
  imports: [HttpModule],
  providers: [SentenceService],
  exports: [SentenceService],
})
export class SentenceModule {}
