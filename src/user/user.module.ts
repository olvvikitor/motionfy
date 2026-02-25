import { Module } from "@nestjs/common";
import { UserRepository } from "./repository/user.repository";
import { ConfigModuleAplication } from "src/config/config.module";
import UserService from "./services/user.service";
import { AuthModule } from "src/auth/auth.module";
import { TracksModule } from "src/tracks/tracks.module";

@Module({
    imports:[ConfigModuleAplication, AuthModule,TracksModule],
    controllers:[],
    providers:[UserRepository,UserService],
    exports:[UserRepository,UserService]
})
export class UserModule{}