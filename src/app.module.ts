import { Module } from '@nestjs/common';
import { ConfigModuleAplication } from './config/config.module';

import { JwtModule } from '@nestjs/jwt';
import { TracksModule } from './modules/tracks/tracks.module';
import { AiModule } from './shared/infra/IA/Ai.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { MusicProviderModule } from './shared/infra/music/music.provider.module';

@Module({
  imports: [MusicProviderModule,
    ConfigModuleAplication,
    JwtModule,
    AuthModule,
    UserModule,
    AiModule,
    TracksModule],
  controllers: [],
  providers: [],
})

export class AppModule { }
