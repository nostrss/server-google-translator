import { SpeechClient } from '@google-cloud/speech';
import { config } from '../config';

let speechClient: SpeechClient | null = null;

export function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    speechClient = new SpeechClient({
      projectId: config.google.projectId,
      credentials: config.google.credentials,
    });
    console.log('Google Cloud Speech 클라이언트 초기화 완료');
  }
  return speechClient;
}
