import http from 'http';
import { createWebSocketServer } from './websocket';
import { handleLanguagesRoute } from './routes/languages';

const PORT = 3000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 라우팅
  if (pathname === '/api/languages' && req.method === 'GET') {
    handleLanguagesRoute(req, res);
  } else if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World');
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: { code: 'NOT_FOUND', message: '경로를 찾을 수 없습니다.' },
    }));
  }
});

createWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`HTTP 서버: http://localhost:${PORT}/`);
  console.log(`WebSocket 서버: ws://localhost:${PORT}/`);
});
