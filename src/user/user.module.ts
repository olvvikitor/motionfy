import { Module } from "@nestjs/common";
import { UserRepository } from "./repository/user.repository";
import { ConfigModuleAplication } from "src/config/config.module";
import UserService from "./services/user.service";
import { AuthModule } from "src/auth/auth.module";

@Module({
    imports:[ConfigModuleAplication, AuthModule],
    controllers:[],
    providers:[UserRepository,UserService],
    exports:[UserRepository,UserService]
})
export class UserModule{}