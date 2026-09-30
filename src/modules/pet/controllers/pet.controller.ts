import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { SavePetDto } from '../dtos/pet.dto';
import { PetService } from '../services/pet.service';

@Controller('user/pet')
@UseGuards(JwtAuthGuard)
export class PetController {
    constructor(private readonly pets: PetService) { }

    // { pet: null } enquanto o usuário não criou o dele.
    @Get()
    async get(@Req() req: MRequest) {
        return await this.pets.get(req.user!.id);
    }

    @Put()
    async save(@Req() req: MRequest, @Body() dto: SavePetDto) {
        return await this.pets.save(req.user!.id, dto);
    }
}
