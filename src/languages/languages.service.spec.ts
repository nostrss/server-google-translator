import { Test, TestingModule } from '@nestjs/testing';
import { LanguagesService } from './languages.service';
import { SUPPORTED_LANGUAGES } from './data/supported-languages';

describe('LanguagesService', () => {
  let service: LanguagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LanguagesService],
    }).compile();

    service = module.get<LanguagesService>(LanguagesService);
  });

  describe('getTranslationLanguages', () => {
    it('전체 언어 목록을 반환한다', () => {
      const result = service.getTranslationLanguages();
      expect(result).toEqual(SUPPORTED_LANGUAGES);
      expect(result.length).toBeGreaterThan(0);
    });

    it('쿼리로 필터링한다', () => {
      const result = service.getTranslationLanguages('korean');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((l) => l.code === 'ko')).toBe(true);
    });

    it('매칭 없으면 빈 배열을 반환한다', () => {
      expect(service.getTranslationLanguages('zzznomatch')).toEqual([]);
    });
  });
});
