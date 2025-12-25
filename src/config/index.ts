import 'dotenv/config';

export const config = {
  google: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  },
  speech: {
    languageCode: 'ko-KR',
    interimResults: true,
    model: 'chirp_3',
    region: process.env.SPEECH_REGION || 'us',
  },
  translation: {
    location: process.env.TRANSLATION_LOCATION || 'global',
    defaultTargetLanguage: process.env.TRANSLATION_DEFAULT_TARGET_LANG || 'en',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  soniox: {
    apiKey: process.env.SONIOX_API_KEY || '',
  },
};
