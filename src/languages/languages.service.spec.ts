import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LanguagesService } from './languages.service';
import { STT_LANGUAGES } from './data/stt-languages';

const mockGetSupportedLanguages = jest.fn();

jest.mock('@google-cloud/translate', () => ({
  TranslationServiceClient: jest.fn().mockImplementation(() => ({
    getSupportedLanguages: mockGetSupportedLanguages,
  })),
}));

describe('LanguagesService', () => {
  let service: LanguagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagesService,
        {
          provide: ConfigService,
          useValue: {
            get: () => 'test-project',
          },
        },
      ],
    }).compile();

    service = module.get<LanguagesService>(LanguagesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSttLanguages', () => {
    it('전체 STT 언어 목록을 반환한다', () => {
      const result = service.getSttLanguages();
      expect(result).toEqual(STT_LANGUAGES);
      expect(result.length).toBeGreaterThan(0);
    });

    it('쿼리로 필터링한다', () => {
      const result = service.getSttLanguages('korean');
      expect(result.length).toBeGreaterThan(0);
      result.forEach((l) =>
        expect(
          l.code.includes('korean') ||
            l.name.toLowerCase().includes('korean') ||
            l.nativeName.toLowerCase().includes('korean'),
        ).toBe(true),
      );
    });

    it('매칭 없으면 빈 배열을 반환한다', () => {
      expect(service.getSttLanguages('zzznomatch')).toEqual([]);
    });
  });

  describe('getTranslationLanguages', () => {
    it('Google API에서 언어 목록을 가져온다', async () => {
      mockGetSupportedLanguages.mockResolvedValue([
        {
          languages: [
            { languageCode: 'en', displayName: 'English' },
            { languageCode: 'ko', displayName: 'Korean' },
          ],
        },
      ]);

      const result = await service.getTranslationLanguages();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ code: 'en', name: 'English', nativeName: 'English' });
    });

    it('24시간 캐시를 사용한다', async () => {
      mockGetSupportedLanguages.mockResolvedValue([
        { languages: [{ languageCode: 'en', displayName: 'English' }] },
      ]);

      await service.getTranslationLanguages();
      await service.getTranslationLanguages();

      expect(mockGetSupportedLanguages).toHaveBeenCalledTimes(1);
    });

    it('API 오류 시 빈 배열을 반환한다', async () => {
      mockGetSupportedLanguages.mockRejectedValue(new Error('API Error'));
      const result = await service.getTranslationLanguages();
      expect(result).toEqual([]);
    });
  });
});
