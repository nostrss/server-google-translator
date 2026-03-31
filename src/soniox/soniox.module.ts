import { Module } from '@nestjs/common';
import { SonioxService } from './soniox.service';

@Module({
  providers: [SonioxService],
  exports: [SonioxService],
})
export class SonioxModule {}
