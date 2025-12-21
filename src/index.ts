import http from 'http';
import { createWebSocketServer } from './websocket';

const PORT = 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World');
});

createWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`HTTP 서버: http://localhost:${PORT}/`);
  console.log(`WebSocket 서버: ws://localhost:${PORT}/`);
});
