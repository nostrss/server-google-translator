import { WebSocketServer, WebSocket } from 'ws';
import { handleSonioxMessage } from './soniox-handlers';
import { closeSonioxSession } from '../soniox';

const sonioxClients = new Map<string, WebSocket>();

export function createSonioxWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Soniox] 새 WebSocket 연결');

    ws.on('message', (rawMessage: Buffer) => {
      handleSonioxMessage(ws, rawMessage, sonioxClients);
    });

    ws.on('close', () => {
      console.log('[Soniox] WebSocket 연결 종료');
      for (const [sessionId, client] of sonioxClients.entries()) {
        if (client === ws) {
          closeSonioxSession(sessionId);
          sonioxClients.delete(sessionId);
          break;
        }
      }
    });

    ws.on('error', (error: Error) => {
      console.error('[Soniox] WebSocket 에러:', error.message);
    });
  });

  return wss;
}

export { sonioxClients };
