import { Inject, Injectable } from "@nestjs/common";
import { Prisma, Track } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";

export type TrackAnalysisWriteInput = {
    spotifyid: string;
    moodScore: number;
    dominantSentiment: string;
    coreAxes: Prisma.JsonValue;
    emotionalVector: Prisma.JsonValue;
    reasoning: string;
    analyzedAt?: Date;
};

export type TrackAnalysisReadItem = {
    spotifyid: string;
    moodScore: number;
    dominantSentiment: string;
    coreAxes: Prisma.JsonValue;
    emotionalVector: Prisma.JsonValue;
    reasoning: string;
    analyzedAt: Date;
};

@Injectable()
export class TrackRepository {
    constructor(@Inject() private prisma: PrismaService) {
    }
    async createNewTrack(data: Prisma.TrackCreateInput): Promise<Track> {
        return await this.prisma.track.upsert({
            where: { spotifyId: data.spotifyId! },
            update: { ...data },
            create: { ...data, img_url: data.img_url },
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
    async findAnalyzedByMusicId(musiId: string[]): Promise<Array<{ spotifyid: string }>> {
        if (!musiId.length) return [];

        return await this.prisma.tracksAnalysis.findMany({
            where: {
                spotifyid: { in: musiId }
            },
            select: {
                spotifyid: true,
            },
        })
    }
    async saveTrackAnalysesBulk(analyses: TrackAnalysisWriteInput[]): Promise<void> {
        if (!analyses.length) return;

        const CHUNK_SIZE = 10;
        for (let i = 0; i < analyses.length; i += CHUNK_SIZE) {
            const chunk = analyses.slice(i, i + CHUNK_SIZE);
            await Promise.all(
                chunk.map((music) =>
                    this.prisma.tracksAnalysis.upsert({
                        where: {
                            spotifyid: music.spotifyid
                        },
                        update: {
                            moodScore: music.moodScore,
                            dominantSentiment: music.dominantSentiment,
                            coreAxes: music.coreAxes as any,
                            emotionalVector: music.emotionalVector as any,
                            reasoning: music.reasoning,
                            analyzedAt: music.analyzedAt ?? new Date(),
                        },
                        create: {
                            spotifyid: music.spotifyid,
                            moodScore: music.moodScore,
                            dominantSentiment: music.dominantSentiment,
                            coreAxes: music.coreAxes as any,
                            emotionalVector: music.emotionalVector as any,
                            reasoning: music.reasoning,
                            analyzedAt: music.analyzedAt ?? new Date(),
                        }
                    })
                )
            );
        }
    }

    async getTrackAnalysesByMusicIds(spotifyIds: string[]): Promise<TrackAnalysisReadItem[]> {
        if (!spotifyIds.length) return [];

        return await this.prisma.tracksAnalysis.findMany({
            where: {
                spotifyid: { in: spotifyIds },
            },
            select: {
                spotifyid: true,
                moodScore: true,
                dominantSentiment: true,
                coreAxes: true,
                emotionalVector: true,
                reasoning: true,
                analyzedAt: true,
            },
        });
    }

    async getMoodAnalysisTracksByUser(userId: string): Promise<Array<{ analyzedAt: Date; tracksAnalyzeds: Prisma.JsonValue }>> {
        return await this.prisma.moodAnalysis.findMany({
            where: { userId },
            select: {
                analyzedAt: true,
                tracksAnalyzeds: true,
            },
            orderBy: {
                analyzedAt: "desc",
            },
        });
    }

    async findTrackReferences(referenceIds: string[]): Promise<Array<{ id: string; spotifyId: string | null }>> {
        if (!referenceIds.length) return [];

        return await this.prisma.track.findMany({
            where: {
                OR: [
                    { id: { in: referenceIds } },
                    { spotifyId: { in: referenceIds } },
                ],
            },
            select: {
                id: true,
                spotifyId: true,
            },
        });
    }

    async getLastListened(userId: string, limit = 15) {
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
            take: limit, // quantidade desejada,

        });

        return records;
    }

    async getListenedToday(userId: string) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const records = await this.prisma.listeningHistory.findMany({
            where: {
                userId,
                playedAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: {
                track: true,
            },
            orderBy: {
                playedAt: "desc",
            },
        });

        return records;
    }

    async getListenedLast24Hours(userId: string) {
        const now = new Date();
        const startOf24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const records = await this.prisma.listeningHistory.findMany({
            where: {
                userId,
                playedAt: {
                    gte: startOf24h,
                    lte: now,
                },
            },
            include: {
                track: true,
            },
            orderBy: {
                playedAt: "desc",
            },
        });

        return records;
    }

}