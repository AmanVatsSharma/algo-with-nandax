import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

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

  // Set global prefix
  app.setGlobalPrefix(apiPrefix);

  await app.listen(port);
  console.log(`🚀 API Server is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`🌍 Environment: ${configService.get('NODE_ENV')}`);
}

bootstrap();
