import { Module } from "@nestjs/common";
import { ConfigModuleAplication } from "src/config/config.module";
import { JwtModuleProvider } from "src/shared/auth/jwt/JwtModuleProvider";
import { PetController } from "./controllers/pet.controller";
import { PetRepository } from "./repository/pet.repository";
import { PetService } from "./services/pet.service";

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider],
    controllers: [PetController],
    providers: [PetRepository, PetService],
})
export class PetModule {}
