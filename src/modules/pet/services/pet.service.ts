import { Injectable } from "@nestjs/common";
import { SavePetDto } from "../dtos/pet.dto";
import { PetRepository } from "../repository/pet.repository";

// Bichinho do card do humor atual: o usuário cria (nome, forma, cor); o que ele faz vem do humor, no front.
@Injectable()
export class PetService {
    constructor(private readonly repository: PetRepository) { }

    async get(userId: string) {
        return { pet: await this.repository.find(userId) };
    }

    async save(userId: string, dto: SavePetDto) {
        return { pet: await this.repository.save(userId, { name: dto.name, species: dto.species, color: dto.color }) };
    }
}
