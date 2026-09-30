import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/config/prisma.service";

const PET_SELECT = { name: true, species: true, color: true, createdAt: true } as const;

@Injectable()
export class PetRepository {
    constructor(private readonly prisma: PrismaService) { }

    async find(userId: string) {
        return this.prisma.pet.findUnique({ where: { userId }, select: PET_SELECT });
    }

    async save(userId: string, data: { name: string; species: string; color: string }) {
        return this.prisma.pet.upsert({
            where: { userId },
            create: { userId, ...data },
            update: data,
            select: PET_SELECT,
        });
    }
}
