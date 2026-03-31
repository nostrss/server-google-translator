import type { RealtimeSttSession } from '@soniox/node';

export interface SonioxSession {
  session: RealtimeSttSession;
  vadTimer: NodeJS.Timeout | null;
  sessionTimer: NodeJS.Timeout;
  lastTokenAt: number;
  isActive: boolean;
}
