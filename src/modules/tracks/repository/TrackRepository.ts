import { Inject, Injectable } from "@nestjs/common";
import { Prisma, Track } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";
import { TrackInput } from "src/shared/types/TrackInput";

export type TrackAnalysisWriteInput = {
    spotifyid: string;
    moodScore: number;
    dominantSentiment: string;
    coreAxes: Prisma.JsonValue;
    emotionalVector: Prisma.JsonValue;
    reasoning: string;
    genre: string;
    subgenre: string;
    analyzedAt?: Date;
};

export type TrackAnalysisReadItem = {
    spotifyid: string;
    moodScore: number;
    dominantSentiment: string;
    coreAxes: Prisma.JsonValue;
    emotionalVector: Prisma.JsonValue;
    reasoning: string;
    genre: string;
    subgenre: string;
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
    // Faixas + histórico em 2 consultas (antes eram 2 por faixa; com o banco longe, ~230 ms cada).
    // Faixa que já existe fica como está; ouvida repetida (mesmo usuário, faixa e hora) é ignorada.
    async saveTracksAndHistory(userId: string, tracks: TrackInput[]): Promise<void> {
        if (!tracks.length) return;
        const unique = [...new Map(tracks.map((t) => [t.spotifyId, t])).values()];
        await this.prisma.track.createMany({
            data: unique.map((t) => ({
                spotifyId: t.spotifyId,
                title: t.title,
                artist: t.artist,
                album: t.album,
                img_url: t.img_url,
                isrc: t.isrc ?? null,
                explicit: t.explicit ?? null,
                releaseDate: t.releaseDate ?? null,
                durationMs: t.durationMs ?? null,
            })),
            skipDuplicates: true,
        });
        await this.prisma.listeningHistory.createMany({
            data: tracks.map((t) => ({ userId, trackId: t.spotifyId, playedAt: t.createdAt })),
            skipDuplicates: true,
        });
    }

    async saveSavedTracks(userId: string, entries: { trackId: string; addedAt: Date }[]): Promise<void> {
        if (!entries.length) return;
        await this.prisma.savedTrack.createMany({
            data: entries.map((entry) => ({ userId, trackId: entry.trackId, addedAt: entry.addedAt })),
            skipDuplicates: true,
        });
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
                            genre: music.genre,
                            subgenre: music.subgenre,
                            coreAxes: music.coreAxes as any,
                            emotionalVector: music.emotionalVector as any,
                            reasoning: music.reasoning,
                            analyzedAt: music.analyzedAt ?? new Date(),
                        },
                        create: {
                            spotifyid: music.spotifyid,
                            moodScore: music.moodScore,
                            dominantSentiment: music.dominantSentiment,
                            genre: music.genre,
                            subgenre: music.subgenre,
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
                genre: true,
                subgenre: true,
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

    async hasListenedSince(userId: string, since: Date): Promise<boolean> {
        const record = await this.prisma.listeningHistory.findFirst({
            where: { userId, playedAt: { gt: since } },
            select: { id: true },
        });
        return Boolean(record);
    }

    async getListenedLast24Hours(userId: string) {
        return this.getListenedLastHours(userId, 24);
    }

    async getListenedLastHours(userId: string, hours: number) {
        const now = new Date();
        const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

        const records = await this.prisma.listeningHistory.findMany({
            where: {
                userId,
                playedAt: {
                    gte: start,
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