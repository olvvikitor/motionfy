import "dotenv/config";

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from "./shared/interceptors/bigInt.interceptor";
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

const LOCAL_NETWORK_HOST_PATTERN = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9-]+|[a-zA-Z0-9-]+\.local)$/;

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;

  const envOrigin = process.env.FRONTEND_URL;
  if (envOrigin && origin === envOrigin) return true;

  try {
    const parsed = new URL(origin);

    if (parsed.hostname.endsWith('.vercel.app')) {
      return true;
    }

    return LOCAL_NETWORK_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });
app.enableCors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
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
