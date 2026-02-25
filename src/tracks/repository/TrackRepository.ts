import { Inject, Injectable } from "@nestjs/common";
import { Prisma, Track } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";

@Injectable()
export class TrackRepository {
    constructor(@Inject() private prisma: PrismaService) {
    }
    async createNewTrack(data: Prisma.TrackCreateInput): Promise<void> {
        await this.prisma.track.upsert({
            where: { spotifyId: data.spotifyId! },
            update: {}, // não atualiza nada (apenas ignora se existir)
            create: data,
        });
    }
    async getTrackById(id: string): Promise<Track | null> {
        return await this.prisma.track.findFirst({
            where: {
                id: id
            }
        })
    }


}