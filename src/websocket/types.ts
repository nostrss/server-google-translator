export interface ClientMessage<T = unknown> {
  event: string;
  data?: T;
  requestId?: string;
}

export interface ServerMessage<T = unknown> {
  event: string;
  data?: T;
  requestId?: string;
  success: boolean;
  error?: string;
}

export const ClientEvents = {
  CONNECT: 'connect',
} as const;

export const ServerEvents = {
  CONNECTED: 'connected',
  ERROR: 'error',
} as const;

export interface ConnectRequestData {
  clientId?: string;
}

export interface ConnectedResponseData {
  sessionId: string;
  message: string;
  timestamp: number;
}
