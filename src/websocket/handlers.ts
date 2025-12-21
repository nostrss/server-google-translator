import { WebSocket } from 'ws';
import crypto from 'crypto';
import {
  ClientMessage,
  ServerMessage,
  ClientEvents,
  ServerEvents,
  ConnectRequestData,
  ConnectedResponseData,
} from './types';

function sendMessage<T>(ws: WebSocket, message: ServerMessage<T>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function handleMessage(
  ws: WebSocket,
  rawMessage: Buffer,
  clients: Map<string, WebSocket>
): void {
  try {
    const message: ClientMessage = JSON.parse(rawMessage.toString());

    switch (message.event) {
      case ClientEvents.CONNECT:
        handleConnect(ws, message as ClientMessage<ConnectRequestData>, clients);
        break;
      default:
        sendMessage(ws, {
          event: ServerEvents.ERROR,
          success: false,
          error: `알 수 없는 이벤트: ${message.event}`,
          requestId: message.requestId,
        });
    }
  } catch {
    sendMessage(ws, {
      event: ServerEvents.ERROR,
      success: false,
      error: '잘못된 메시지 형식입니다.',
    });
  }
}

function handleConnect(
  ws: WebSocket,
  message: ClientMessage<ConnectRequestData>,
  clients: Map<string, WebSocket>
): void {
  const sessionId = crypto.randomUUID();

  clients.set(sessionId, ws);

  const response: ServerMessage<ConnectedResponseData> = {
    event: ServerEvents.CONNECTED,
    data: {
      sessionId,
      message: '연결이 정상적으로 완료되었습니다.',
      timestamp: Date.now(),
    },
    requestId: message.requestId,
    success: true,
  };

  sendMessage(ws, response);
  console.log(`클라이언트 연결 완료: ${sessionId}`);
}
