import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { SpotifyStrategy } from "./strategies/spotify.strategies";
import { ConfigModuleAplication } from "src/config/config.module";
import { CreateUserService } from "./services/create.user.service";
import { UserRepository } from "../user/repository/user.repository";
import { JwtModuleProvider } from "src/shared/providers/jwt/JwtModuleProvider";

@Module({
    imports:[ConfigModuleAplication, JwtModuleProvider],
    controllers:[AuthController],
    providers:[SpotifyStrategy,CreateUserService, UserRepository]
})
export class AuthModule{}