import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/config/prisma.service";

const LIBRARY_LIST_LIMIT = 1000;

export type LibraryTrackRow = {
    spotifyId: string;
    title: string;
    artist: string;
    imgUrl: string;
    addedAt: Date;
    sentiment: string | null;
};

// A biblioteca do usuário mora na tabela SavedTrack.
@Injectable()
export class LibraryRepository {
    constructor(private readonly prisma: PrismaService) { }

    async getUser(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, provider: true, refreshToken: true },
        });
    }

    async count(userId: string): Promise<number> {
        return this.prisma.savedTrack.count({ where: { userId } });
    }

    // Quais destas músicas já estão na biblioteca.
    async findInLibrary(userId: string, spotifyIds: string[]): Promise<Set<string>> {
        if (!spotifyIds.length) return new Set();
        const rows = await this.prisma.savedTrack.findMany({
            where: { userId, trackId: { in: spotifyIds } },
            select: { trackId: true },
        });
        return new Set(rows.map((row) => row.trackId));
    }

    // Mais recentes primeiro, com o sentimento da análise quando já existe.
    async list(userId: string): Promise<LibraryTrackRow[]> {
        const rows = await this.prisma.savedTrack.findMany({
            where: { userId },
            orderBy: { addedAt: "desc" },
            take: LIBRARY_LIST_LIMIT,
            select: { addedAt: true, track: { select: { spotifyId: true, title: true, artist: true, img_url: true } } },
        });

        const ids = rows.map((row) => row.track.spotifyId).filter((id): id is string => Boolean(id));
        const analyses = ids.length
            ? await this.prisma.tracksAnalysis.findMany({
                where: { spotifyid: { in: ids } },
                select: { spotifyid: true, dominantSentiment: true },
            })
            : [];
        const sentimentById = new Map(analyses.map((a) => [a.spotifyid, a.dominantSentiment]));

        return rows.flatMap((row) => {
            const spotifyId = row.track.spotifyId;
            if (!spotifyId) return [];
            return [{
                spotifyId,
                title: row.track.title,
                artist: row.track.artist,
                imgUrl: row.track.img_url ?? "",
                addedAt: row.addedAt,
                sentiment: sentimentById.get(spotifyId) ?? null,
            }];
        });
    }

    async remove(userId: string, spotifyId: string): Promise<number> {
        const { count } = await this.prisma.savedTrack.deleteMany({ where: { userId, trackId: spotifyId } });
        return count;
    }
}
