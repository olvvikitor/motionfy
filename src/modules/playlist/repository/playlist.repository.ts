import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/config/prisma.service";
import { EMOTIONAL_DIMENSIONS } from "src/shared/infra/IA/emotion-analysis.service";
import { JourneyCandidate, Vector } from "../services/journey-path";

const POOL_LIMIT = 5000;

export type UserTaste = {
    historyIds: Set<string>;
    topArtists: string[];
    topSubgenres: string[];
};

@Injectable()
export class PlaylistRepository {
    constructor(private readonly prisma: PrismaService) { }

    async getUser(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, provider: true, refreshToken: true },
        });
    }

    async getUserTaste(userId: string): Promise<UserTaste> {
        const history = await this.prisma.listeningHistory.findMany({
            where: { userId },
            select: { track: { select: { spotifyId: true, artist: true } } },
        });

        const historyIds = new Set(history.map(h => h.track.spotifyId).filter((id): id is string => Boolean(id)));

        const analyses = await this.prisma.tracksAnalysis.findMany({
            where: { spotifyid: { in: [...historyIds] } },
            select: { subgenre: true },
        });

        return {
            historyIds,
            topArtists: this.rankByCount(history.map(h => h.track.artist.split(', ')[0])),
            topSubgenres: this.rankByCount(analyses.map(a => a.subgenre).filter(sg => sg && sg !== 'Unknown')),
        };
    }

    // Todo o acervo analisado (de todos os usuários), já no formato de candidata.
    async getAnalyzedPool(historyIds: Set<string>): Promise<JourneyCandidate[]> {
        const analyses = await this.prisma.tracksAnalysis.findMany({
            select: { spotifyid: true, emotionalVector: true, dominantSentiment: true },
            orderBy: { analyzedAt: 'desc' },
            take: POOL_LIMIT,
        });

        const tracks = await this.prisma.track.findMany({
            where: { spotifyId: { in: analyses.map(a => a.spotifyid) } },
            select: { spotifyId: true, title: true, artist: true, img_url: true, durationMs: true },
        });
        const trackById = new Map(tracks.map(t => [t.spotifyId, t]));

        return analyses.flatMap(analysis => {
            const track = trackById.get(analysis.spotifyid);
            const vector = this.toVector(analysis.emotionalVector);
            if (!track || !vector) return [];

            return [{
                spotifyId: analysis.spotifyid,
                title: track.title,
                artist: track.artist,
                imgUrl: track.img_url ?? '',
                durationMs: track.durationMs,
                vector,
                dominantSentiment: analysis.dominantSentiment,
                fromUserHistory: historyIds.has(analysis.spotifyid),
            }];
        });
    }

    private toVector(value: unknown): Vector | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const raw = value as Record<string, unknown>;
        const vector: Vector = {};
        for (const dimension of EMOTIONAL_DIMENSIONS) {
            const n = raw[dimension];
            if (typeof n !== 'number' || !Number.isFinite(n)) return null;
            vector[dimension] = n;
        }
        return vector;
    }

    private rankByCount(values: string[]): string[] {
        const counts = new Map<string, number>();
        for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    }
}
