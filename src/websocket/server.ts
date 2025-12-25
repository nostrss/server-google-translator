import { WebSocketServer, WebSocket } from 'ws';
import { handleMessage } from './handlers';
import { closeSpeechSession } from '../speech';

const googleClients = new Map<string, WebSocket>();

export function createGoogleWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Google] 새 WebSocket 연결');

    ws.on('message', (rawMessage: Buffer) => {
      handleMessage(ws, rawMessage, googleClients);
    });

    ws.on('close', () => {
      console.log('[Google] WebSocket 연결 종료');
      for (const [sessionId, client] of googleClients.entries()) {
        if (client === ws) {
          closeSpeechSession(sessionId);
          googleClients.delete(sessionId);
          break;
        }
      }
    });

    ws.on('error', (error: Error) => {
      console.error('[Google] WebSocket 에러:', error.message);
    });
  });

  return wss;
}

export { googleClients };
