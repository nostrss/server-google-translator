import { stripWavHeader, extractLangCode } from './audio.utils';

describe('stripWavHeader', () => {
  it('WAV 헤더가 있으면 44바이트를 제거한다', () => {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.write('WAVE', 8);
    const pcm = Buffer.from([0x01, 0x02, 0x03]);
    const input = Buffer.concat([header, pcm]);

    const result = stripWavHeader(input);
    expect(result).toEqual(pcm);
  });

  it('WAV 헤더가 없으면 그대로 반환한다', () => {
    const pcm = Buffer.from([0x01, 0x02, 0x03]);
    expect(stripWavHeader(pcm)).toEqual(pcm);
  });

  it('44바이트 이하 버퍼는 그대로 반환한다', () => {
    const small = Buffer.alloc(44);
    small.write('RIFF', 0);
    small.write('WAVE', 8);
    expect(stripWavHeader(small)).toEqual(small);
  });
});

describe('extractLangCode', () => {
  it('BCP-47 코드에서 언어 코드만 추출한다', () => {
    expect(extractLangCode('ko-KR')).toBe('ko');
    expect(extractLangCode('en-US')).toBe('en');
    expect(extractLangCode('zh-TW')).toBe('zh');
  });

  it('하이픈 없는 코드는 소문자로 반환한다', () => {
    expect(extractLangCode('KO')).toBe('ko');
    expect(extractLangCode('en')).toBe('en');
  });

  it('undefined/빈 문자열이면 빈 문자열을 반환한다', () => {
    expect(extractLangCode(undefined)).toBe('');
    expect(extractLangCode('')).toBe('');
  });
});
