import { Module } from "@nestjs/common";
import { UserRepository } from "./repository/user.repository";
import { ConfigModuleAplication } from "src/config/config.module";

@Module({
    imports:[ConfigModuleAplication],
    controllers:[],
    providers:[UserRepository],
    exports:[UserRepository]
})
export class UserModule{}