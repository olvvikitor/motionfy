import { Module } from "@nestjs/common";
import { ConfigModuleAplication } from "src/config/config.module";
import { JwtModuleProvider } from "src/shared/auth/jwt/JwtModuleProvider";
import { LibraryController } from "./controllers/library.controller";
import { LibraryRepository } from "./repository/library.repository";
import { LibraryService } from "./services/library.service";

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider],
    controllers: [LibraryController],
    providers: [LibraryRepository, LibraryService],
})
export class LibraryModule {}
