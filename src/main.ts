import "dotenv/config";

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from "./shared/interceptors/bigInt.interceptor";
import { ValidationPipe } from '@nestjs/common';

const allowedOriginPattern = /^(https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?)$/;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOriginPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalInterceptors(new BigIntInterceptor());

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
