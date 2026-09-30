import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/config/prisma.service";

const LIBRARY_LIST_LIMIT = 1000;

export type LibraryTrackRow = {
    spotifyId: string;
    title: string;
    artist: string;
    imgUrl: string;
    lastPlayedAt: Date;
    sentiment: string | null;
};

// A biblioteca do usuário é o histórico dele (ListeningHistory), uma linha por música.
@Injectable()
export class LibraryRepository {
    constructor(private readonly prisma: PrismaService) { }

    async count(userId: string): Promise<number> {
        return this.prisma.track.count({ where: { histories: { some: { userId } } } });
    }

    // Tocadas mais recentemente primeiro, com o sentimento da análise quando já existe.
    async list(userId: string): Promise<LibraryTrackRow[]> {
        const plays = await this.prisma.listeningHistory.groupBy({
            by: ["trackId"],
            where: { userId },
            _max: { playedAt: true },
            orderBy: { _max: { playedAt: "desc" } },
            take: LIBRARY_LIST_LIMIT,
        });
        const ids = plays.map((p) => p.trackId);
        if (!ids.length) return [];

        const [tracks, analyses] = await Promise.all([
            this.prisma.track.findMany({
                where: { spotifyId: { in: ids } },
                select: { spotifyId: true, title: true, artist: true, img_url: true },
            }),
            this.prisma.tracksAnalysis.findMany({
                where: { spotifyid: { in: ids } },
                select: { spotifyid: true, dominantSentiment: true },
            }),
        ]);
        const trackById = new Map(tracks.map((t) => [t.spotifyId, t]));
        const sentimentById = new Map(analyses.map((a) => [a.spotifyid, a.dominantSentiment]));

        return plays.flatMap((play) => {
            const track = trackById.get(play.trackId);
            if (!track) return [];
            return [{
                spotifyId: play.trackId,
                title: track.title,
                artist: track.artist,
                imgUrl: track.img_url ?? "",
                lastPlayedAt: play._max.playedAt!,
                sentiment: sentimentById.get(play.trackId) ?? null,
            }];
        });
    }
}
