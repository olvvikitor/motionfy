import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { SpotifyStrategy } from "./strategies/spotify.strategies";
import { ConfigModuleAplication } from "src/config/config.module";
import { CreateUserService } from "./services/create.user.service";

@Module({
    imports:[ConfigModuleAplication],
    controllers:[AuthController],
    providers:[SpotifyStrategy,CreateUserService]
})
export default class AuthModule{}