import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "./authGuardService";

@Module({
    imports: [JwtModule.register({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '7d' }
    })],
    controllers: [],
    providers: [JwtAuthGuard],
    exports:[JwtModule, JwtAuthGuard]

})
export class JwtModuleProvider{}