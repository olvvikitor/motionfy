import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { SpotifyStrategy } from "./strategies/spotify.strategies";
import { ConfigModuleAplication } from "src/config/config.module";
import { CreateUserService } from "./services/create.user.service";
import { UserRepository } from "../user/repository/user.repository";
import { SpotifyService } from "./services/spotfy.service";
import { JwtModuleProvider } from "src/shared/auth/jwt/JwtModuleProvider";
import { MusicProviderModule } from "src/shared/infra/music/music.provider.module";

@Module({
    imports:[ConfigModuleAplication, JwtModuleProvider, MusicProviderModule],
    controllers:[AuthController],
    providers:[SpotifyStrategy,CreateUserService, UserRepository, SpotifyService],
    exports:[SpotifyService]
})
export class AuthModule{}