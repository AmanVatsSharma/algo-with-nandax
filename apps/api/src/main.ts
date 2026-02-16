import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3001;
  const apiPrefix = configService.get('API_PREFIX') || 'api/v1';

  // Enable CORS
  app.enableCors({
    origin: configService.get('FRONTEND_URL') || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.use(cookieParser());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestIdHeader = req.headers['x-request-id'];
    const requestId = Array.isArray(requestIdHeader)
      ? requestIdHeader[0]
      : requestIdHeader || randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    const startTime = Date.now();
    res.on('finish', () => {
      logger.debug(
        `requestId=${requestId} method=${req.method} path=${req.originalUrl} status=${res.statusCode} durationMs=${Date.now() - startTime}`,
      );
    });

    next();
  });

  // Set global prefix
  app.setGlobalPrefix(apiPrefix);

  await app.listen(port);
  logger.log(`API Server is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`Environment: ${configService.get('NODE_ENV')}`);
}

bootstrap();
