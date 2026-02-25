import "dotenv/config";

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from "./shared/interceptors/bigInt.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  process.env.ENVIROMENT === 'tel' ? console.log('http://10.71.200.1:3000/auth/spotify/callback') : console.log('http://127.0.0.1:3000/auth/spotify/callback')
  app.enableCors()
  app.useGlobalInterceptors(new BigIntInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
