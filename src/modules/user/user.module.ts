import { Module } from "@nestjs/common";
import { UserRepository } from "./repository/user.repository";
import { ConfigModuleAplication } from "src/config/config.module";
import UserService from "./services/user.service";
import { TracksModule } from "src/modules/tracks/tracks.module";
import { AiModule } from "src/shared/infra/IA/Ai.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports:[ConfigModuleAplication, AuthModule,TracksModule, AiModule],
    controllers:[],
    providers:[UserRepository,UserService],
    exports:[UserRepository,UserService]
})
export class UserModule{}