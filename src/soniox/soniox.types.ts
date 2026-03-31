import type { RealtimeSttSession } from '@soniox/node';

export interface SonioxSessionState {
  accumulatedOriginal: string;
  accumulatedTranslation: string;
  segmentIndex: number;
  detectedLanguage: string;
}

export interface SonioxSession {
  session: RealtimeSttSession;
  vadTimer: NodeJS.Timeout | null;
  sessionTimer: NodeJS.Timeout;
  lastTokenAt: number;
  isActive: boolean;
  state: SonioxSessionState;
}
