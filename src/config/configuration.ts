export default () => ({
  port: parseInt(process.env.PORT ?? '8080', 10),
translation: {
    location: process.env.TRANSLATION_LOCATION ?? 'global',
    defaultTargetLanguage: process.env.TRANSLATION_DEFAULT_TARGET_LANG ?? 'en',
  },
  soniox: {
    apiKey: process.env.SONIOX_API_KEY ?? '',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
  },
  sentenceSplitter: {
    url: process.env.SENTENCE_SPLITTER_URL ?? 'http://localhost:8001',
  },
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [],
  },
});
