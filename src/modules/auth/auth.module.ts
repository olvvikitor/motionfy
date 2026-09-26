import { forwardRef, Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { ConfigModuleAplication } from "src/config/config.module";
import { JwtModuleProvider } from "src/shared/auth/jwt/JwtModuleProvider";
import { MusicProviderModule } from "src/shared/infra/music/music.provider.module";

import { AuthService } from "./services/auth.service";
import { UserModule } from "../user/user.module";

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider, MusicProviderModule, forwardRef(() => UserModule)],
    controllers: [AuthController],
    providers: [AuthService],
    exports: []
})
export class AuthModule { }