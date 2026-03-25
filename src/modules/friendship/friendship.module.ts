import { Module } from '@nestjs/common';
import { FriendshipRepository } from './repository/friendship.repository';
import { FriendshipService } from './services/friendship.service';
import { FriendshipController } from './controllers/friendship.controller';
import { ConfigModuleAplication } from 'src/config/config.module';
import { JwtModuleProvider } from 'src/shared/auth/jwt/JwtModuleProvider';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider, AuthModule, UserModule],
    controllers: [FriendshipController],
    providers: [FriendshipRepository, FriendshipService],
    exports: [FriendshipRepository, FriendshipService],
})
export class FriendshipModule {}
