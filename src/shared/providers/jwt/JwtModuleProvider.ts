import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard } from "./authGuardService";

@Module({
    imports: [JwtModule.register({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '7d' }
    })],
    controllers: [],
    providers: [AuthGuard],
    exports:[JwtModule, AuthGuard]

})
export class JwtModuleProvider{}