import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TranslateService } from './translate.service';

const mockTranslateText = jest.fn();
const mockGenerateContent = jest.fn();

jest.mock('@google-cloud/translate', () => ({
  TranslationServiceClient: jest.fn().mockImplementation(() => ({
    translateText: mockTranslateText,
  })),
}));

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
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
                'google.projectId': 'test-project',
                'google.clientEmail': 'test@test.iam.gserviceaccount.com',
                'google.privateKey': '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
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

  describe('translate - advanced 모드', () => {
    it('Cloud Translation LLM 모델로 번역한다', async () => {
      mockTranslateText.mockResolvedValue([
        { translations: [{ translatedText: 'Hello' }] },
      ]);

      const result = await service.translate('안녕하세요', 'ko', 'en', 'advanced');

      expect(mockTranslateText).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: ['안녕하세요'],
          sourceLanguageCode: 'ko',
          targetLanguageCode: 'en',
          model: expect.stringContaining('translation-llm'),
        }),
      );
      expect(result.translatedText).toBe('Hello');
      expect(result.originalText).toBe('안녕하세요');
    });
  });

  describe('translate - standard 모드', () => {
    it('Gemini로 번역한다', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
        },
      });

      const result = await service.translate('안녕하세요', 'ko', 'en', 'standard');

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(result.translatedText).toBe('Hello');
    });

    it('번역 결과가 없으면 빈 문자열을 반환한다', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [] },
      });

      const result = await service.translate('안녕하세요', 'ko', 'en', 'standard');
      expect(result.translatedText).toBe('');
    });
  });

  describe('advanced 모드 1 QPS 큐잉', () => {
    it('여러 요청이 순차적으로 처리된다', async () => {
      const order: number[] = [];
      mockTranslateText
        .mockImplementationOnce(async () => {
          order.push(1);
          return [{ translations: [{ translatedText: 'A' }] }];
        })
        .mockImplementationOnce(async () => {
          order.push(2);
          return [{ translations: [{ translatedText: 'B' }] }];
        });

      await Promise.all([
        service.translate('텍스트1', 'ko', 'en', 'advanced'),
        service.translate('텍스트2', 'ko', 'en', 'advanced'),
      ]);

      expect(order).toEqual([1, 2]);
    });
  });
});
