import { Module } from '@nestjs/common';
import { FriendshipRepository } from './repository/friendship.repository';
import { FriendshipService } from './services/friendship.service';
import { FriendshipController } from './controllers/friendship.controller';
import { ConfigModuleAplication } from 'src/config/config.module';
import { JwtModuleProvider } from 'src/shared/auth/jwt/JwtModuleProvider';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { PlaylistModule } from '../playlist/playlist.module';
import { PetModule } from '../pet/pet.module';
import { FeedRepository } from './repository/feed.repository';
import { FeedService } from './services/feed.service';

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider, AuthModule, UserModule, PlaylistModule, PetModule],
    controllers: [FriendshipController],
    providers: [FriendshipRepository, FriendshipService, FeedRepository, FeedService],
    exports: [FriendshipRepository, FriendshipService],
})
export class FriendshipModule {}
