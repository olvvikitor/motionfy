import { Module } from "@nestjs/common";
import { UserRepository } from "./repository/user.repository";
import { ConfigModuleAplication } from "src/config/config.module";
import UserService from "./services/user.service";
import { AuthModule } from "src/auth/auth.module";
import { TracksModule } from "src/tracks/tracks.module";
import { AiModule } from "src/shared/providers/IA/Ai.module";

@Module({
    imports:[ConfigModuleAplication, AuthModule,TracksModule, AiModule],
    controllers:[],
    providers:[UserRepository,UserService],
    exports:[UserRepository,UserService]
})
export class UserModule{}