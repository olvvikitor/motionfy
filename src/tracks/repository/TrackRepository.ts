import { Inject, Injectable } from "@nestjs/common";
import { Prisma, Track } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";

@Injectable()
export class TrackRepository {
    constructor(@Inject() private prisma: PrismaService) {
    }
    async createNewTrack(data: Prisma.TrackCreateInput): Promise<Track> {
        return await this.prisma.track.upsert({
            where: { spotifyId: data.spotifyId! },
            update: {},
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
    async saveHistoryListen(userId: string, trackId: string, playedAt: Date): Promise<any> {
        await this.prisma.listeningHistory.upsert({
            where: {
                userId_trackId_playedAt: {
                    playedAt: playedAt, trackId: trackId, userId: userId
                }
            },
            update: {},
            create: {
                userId,
                trackId,
                playedAt
            }
        })
    }
    async getLastListened(userId: string, limit = 10) {
        const records = await this.prisma.listeningHistory.findMany({
            where: {
                userId,
            },
            include: {
                track: true,
            },
            orderBy: {
                playedAt: "desc", // mais recentes primeiro
            },
            take: limit, // quantidade desejada
        });

        return records;
    }

}