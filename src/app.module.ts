import { Module } from '@nestjs/common';
import {AuthModule} from './auth/auth.module';
import { ConfigModuleAplication } from './config/config.module';
import { UserModule } from './user/user.module';
import { UserController } from './user/controllers/user.controller';
import { JwtModule } from '@nestjs/jwt';
import { TracksModule } from './tracks/tracks.module';
import { LyricsModule } from './shared/providers/genius/genius.module';
import { AiModule } from './shared/providers/IA/Ai.module';

@Module({
  imports: [ConfigModuleAplication,JwtModule,AuthModule,UserModule,AiModule, TracksModule, LyricsModule],
  controllers: [UserController],
  providers: [],
})

export class AppModule {}
