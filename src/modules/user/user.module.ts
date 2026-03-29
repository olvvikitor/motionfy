import { Module } from "@nestjs/common";
import { UserRepository } from "./repository/user.repository";
import { ConfigModuleAplication } from "src/config/config.module";
import {UserService} from "./services/user.service";
import { TracksModule } from "src/modules/tracks/tracks.module";
import { AiModule } from "src/shared/infra/IA/Ai.module";
import { AuthModule } from "../auth/auth.module";
import { MusicProviderModule } from "src/shared/infra/music/music.provider.module";
import { CreateUserService } from "./services/create.user.service";
import { JwtModuleProvider } from "src/shared/auth/jwt/JwtModuleProvider";
import { UserController } from "./controllers/user.controller";
import { StorageModule } from "src/shared/infra/storage/storage.module";

@Module({
    imports:[ConfigModuleAplication,JwtModuleProvider, AuthModule,TracksModule, AiModule, MusicProviderModule, StorageModule],
    controllers:[UserController],
    providers:[UserRepository,UserService,CreateUserService],
    exports:[UserRepository,UserService,CreateUserService]
})
export class UserModule{}