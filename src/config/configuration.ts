export default () => ({
  port: parseInt(process.env.PORT ?? '8080', 10),
  google: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  translation: {
    location: process.env.TRANSLATION_LOCATION ?? 'global',
    defaultTargetLanguage: process.env.TRANSLATION_DEFAULT_TARGET_LANG ?? 'en',
  },
  soniox: {
    apiKey: process.env.SONIOX_API_KEY ?? '',
  },
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [],
  },
});
