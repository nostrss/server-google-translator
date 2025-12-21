import { v2 } from '@google-cloud/speech';
import { config } from '../config';

type SpeechClientV2 = InstanceType<typeof v2.SpeechClient>;

let speechClient: SpeechClientV2 | null = null;

export function getSpeechClient(): SpeechClientV2 {
  if (!speechClient) {
    const region = config.speech.region;
    speechClient = new v2.SpeechClient({
      projectId: config.google.projectId,
      credentials: config.google.credentials,
      apiEndpoint: `${region}-speech.googleapis.com`,
    });
    console.log(`Google Cloud Speech V2 클라이언트 초기화 완료 (region: ${region})`);
  }
  return speechClient;
}

export function getRecognizerPath(): string {
  const projectId = config.google.projectId;
  const region = config.speech.region;
  return `projects/${projectId}/locations/${region}/recognizers/_`;
}
