import { WebSocket } from 'ws';
import { ServerMessage } from './types';

export function sendMessage<T>(ws: WebSocket, message: ServerMessage<T>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function getSessionIdByWs(
  ws: WebSocket,
  clients: Map<string, WebSocket>
): string | null {
  for (const [sessionId, client] of clients.entries()) {
    if (client === ws) {
      return sessionId;
    }
  }
  return null;
}

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
  if (!languageCode) return 'ko';
  return languageCode.split('-')[0];
}
