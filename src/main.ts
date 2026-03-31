import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.useWebSocketAdapter(new WsAdapter(app));

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`서버 실행 중: http://localhost:${port}`);

  process.on('SIGTERM', async () => {
    console.log('SIGTERM 수신, 서버를 종료합니다...');
    await app.close();
  });
}

bootstrap();
