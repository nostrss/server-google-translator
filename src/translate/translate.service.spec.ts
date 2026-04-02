import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TranslateService } from './translate.service';

const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn().mockReturnValue(
    (modelId: string) => ({ modelId, provider: 'openrouter' }),
  ),
}));

describe('TranslateService', () => {
  let service: TranslateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslateService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                'openrouter.apiKey': 'sk-or-server-test',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<TranslateService>(TranslateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('gemma-3n (무료)', () => {
    it('서버 OpenRouter 키로 번역한다', async () => {
      mockGenerateText.mockResolvedValue({ text: 'Hello' });

      const result = await service.translate('안녕하세요', 'ko', 'en', 'gemma-3n');

      expect(mockGenerateText).toHaveBeenCalled();
      expect(result.translatedText).toBe('Hello');
    });
  });

  describe('유료 모델', () => {
    it('OpenRouter 키로 번역한다', async () => {
      mockGenerateText.mockResolvedValue({ text: 'Hello' });

      const result = await service.translate('안녕하세요', 'ko', 'en', 'gpt-4.1-nano', {
        openrouterKey: 'sk-or-user-test',
      });

      expect(mockGenerateText).toHaveBeenCalled();
      expect(result.translatedText).toBe('Hello');
    });

    it('API 키 없으면 에러를 던진다', async () => {
      await expect(
        service.translate('안녕하세요', 'ko', 'en', 'gpt-4.1-nano'),
      ).rejects.toThrow('API key is required for this model.');
    });

    it('모든 유료 모델에서 키 없으면 에러를 던진다', async () => {
      const paidModes = [
        'gemini-flash-lite', 'gemini-3-flash', 'gpt-4.1-nano', 'gpt-5-nano', 'gpt-4.1-mini',
        'claude-haiku', 'claude-sonnet',
        'gemini-flash', 'qwen-3.5-flash',
        'mistral-small', 'llama-3.3-70b',
      ] as const;

      for (const mode of paidModes) {
        await expect(
          service.translate('안녕하세요', 'ko', 'en', mode),
        ).rejects.toThrow('API key is required for this model.');
      }
    });
  });
});
