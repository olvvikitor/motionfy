import { Module } from '@nestjs/common';
import AuthModule from './auth/auth.module';
import { ConfigModuleAplication } from './config/config.module';

@Module({
  imports: [ConfigModuleAplication,AuthModule],
  controllers: [],
  providers: [],
})

export class AppModule {}
