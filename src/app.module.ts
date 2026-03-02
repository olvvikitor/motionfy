import { Module } from '@nestjs/common';
import { ConfigModuleAplication } from './config/config.module';

import { JwtModule } from '@nestjs/jwt';
import { TracksModule } from './modules/tracks/tracks.module';
import { AiModule } from './shared/infra/IA/Ai.module';
import { UserModule } from './modules/user/user.module';
import { UserController } from './modules/user/controllers/user.controller';
import { AuthModule } from './modules/auth/auth.module';
import { MusicProviderModule } from './shared/infra/music/music.provider.module';

@Module({
  imports: [MusicProviderModule, ConfigModuleAplication, JwtModule, AuthModule, UserModule, AiModule, TracksModule],
  controllers: [UserController],
  providers: [],
})

export class AppModule { }
