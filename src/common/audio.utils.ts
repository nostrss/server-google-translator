export function stripWavHeader(buffer: Buffer): Buffer {
  if (
    buffer.length > 44 &&
    buffer.slice(0, 4).toString() === 'RIFF' &&
    buffer.slice(8, 12).toString() === 'WAVE'
  ) {
    return buffer.slice(44);
  }
  return buffer;
}

export function extractLangCode(languageCode?: string): string {
  if (!languageCode) return '';
  return languageCode.split('-')[0].toLowerCase();
}
