import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { handleMessage } from './handlers';
import { closeSpeechSession } from '../speech';

const clients = new Map<string, WebSocket>();

export function createWebSocketServer(httpServer: HTTPServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws: WebSocket) => {
    console.log('새 WebSocket 연결');

    ws.on('message', (rawMessage: Buffer) => {
      handleMessage(ws, rawMessage, clients);
    });

    ws.on('close', () => {
      console.log('WebSocket 연결 종료');
      for (const [sessionId, client] of clients.entries()) {
        if (client === ws) {
          closeSpeechSession(sessionId);
          clients.delete(sessionId);
          break;
        }
      }
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket 에러:', error.message);
    });
  });

  return wss;
}

export { clients };
