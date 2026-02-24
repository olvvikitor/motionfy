import { Module } from '@nestjs/common';
import {AuthModule} from './auth/auth.module';
import { ConfigModuleAplication } from './config/config.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [ConfigModuleAplication,AuthModule,UserModule],
  controllers: [],
  providers: [],
})

export class AppModule {}
