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
    encoding: 'LINEAR16' as const,
    sampleRateHertz: 16000,
    languageCode: 'ko-KR',
    interimResults: true,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
};
