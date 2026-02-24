import { Module } from '@nestjs/common';
import {AuthModule} from './auth/auth.module';
import { ConfigModuleAplication } from './config/config.module';
import { UserModule } from './user/user.module';
import { UserController } from './user/controllers/user.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [ConfigModuleAplication,JwtModule,AuthModule,UserModule],
  controllers: [UserController],
  providers: [],
})

export class AppModule {}
