import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SentenceService {
  private readonly logger = new Logger(SentenceService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async split(text: string, language?: string): Promise<string[]> {
    try {
      const url = this.configService.get<string>('sentenceSplitter.url');
      const { data } = await firstValueFrom(
        this.httpService.post(`${url}/split`, { text, language: language ?? '' }, { timeout: 3000 }),
      );
      return data.sentences?.length ? data.sentences : [text];
    } catch {
      this.logger.warn('문장 분리 서비스 실패, fallback 사용');
      return [text];
    }
  }
}
