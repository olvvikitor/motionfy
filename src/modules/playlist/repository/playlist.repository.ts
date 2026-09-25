import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/config/prisma.service";
import { EMOTIONAL_DIMENSIONS } from "src/shared/infra/IA/emotion-analysis.service";
import { JourneyCandidate, Vector } from "../services/journey-path";

const POOL_LIMIT = 5000;

export type UserTaste = {
    // Faixas que o usuário ouviu ou curtiu — recebem preferência na jornada.
    tasteIds: Set<string>;
    savedIds: Set<string>;
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

    // Sentimento da análise de humor mais recente do usuário, se houver.
    async getCurrentMood(userId: string): Promise<string | null> {
        const latest = await this.prisma.moodAnalysis.findFirst({
            where: { userId },
            orderBy: { analyzedAt: 'desc' },
            select: { sentiment: true },
        });
        return latest?.sentiment ?? null;
    }

    // Músicas sugeridas ao usuário em playlists de jornada desde `since`.
    async getRecentSuggestionIds(userId: string, since: Date): Promise<Set<string>> {
        const rows = await this.prisma.playlistSuggestion.findMany({
            where: { userId, suggestedAt: { gte: since } },
            select: { spotifyId: true },
            distinct: ['spotifyId'],
        });
        return new Set(rows.map(r => r.spotifyId));
    }

    // Grava a sugestão nova e apaga as que já saíram da janela (não servem mais para nada).
    async saveSuggestions(userId: string, spotifyIds: string[], pruneBefore: Date): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.playlistSuggestion.deleteMany({ where: { userId, suggestedAt: { lt: pruneBefore } } }),
            this.prisma.playlistSuggestion.createMany({ data: spotifyIds.map(spotifyId => ({ userId, spotifyId })) }),
        ]);
    }

    async findMofyPlaylist(userId: string, tracksHash: string) {
        return this.prisma.mofyPlaylist.findFirst({ where: { userId, tracksHash, removedAt: null }, orderBy: { createdAt: 'desc' } });
    }

    // Só quem criou a playlist pode mudar a capa dela.
    async findOwnedMofyPlaylist(userId: string, spotifyPlaylistId: string) {
        return this.prisma.mofyPlaylist.findFirst({ where: { userId, spotifyPlaylistId, removedAt: null }, select: { id: true, sentiment: true } });
    }

    async getFacePhotoPath(userId: string): Promise<string | null> {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { face_photo_path: true } });
        return user?.face_photo_path ?? null;
    }

    async countMofyPlaylistsSince(userId: string, since: Date): Promise<number> {
        return this.prisma.mofyPlaylist.count({ where: { userId, createdAt: { gte: since } } });
    }

    async saveMofyPlaylist(data: {
        userId: string; spotifyPlaylistId: string; url: string; tracksHash: string;
        title: string; sentiment: string | null; fromSentiment: string | null; trackIds: string[]; featuredOrder: number | null;
    }): Promise<void> {
        await this.prisma.mofyPlaylist.create({ data });
    }

    async countFeaturedMofyPlaylists(userId: string): Promise<number> {
        return this.prisma.mofyPlaylist.count({ where: { userId, removedAt: null, featuredOrder: { not: null } } });
    }

    // Todas as playlists do usuário ainda na conta do Mofy, das mais novas.
    async listMofyPlaylists(userId: string) {
        return this.prisma.mofyPlaylist.findMany({
            where: { userId, removedAt: null },
            orderBy: { createdAt: 'desc' },
            select: {
                spotifyPlaylistId: true, url: true, title: true, sentiment: true, fromSentiment: true,
                trackIds: true, coverUrl: true, featuredOrder: true, createdAt: true,
            },
        });
    }

    // Destaque do perfil: só as escolhidas ficam com posição (na ordem recebida).
    async setFeaturedMofyPlaylists(userId: string, spotifyPlaylistIds: string[]): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.mofyPlaylist.updateMany({ where: { userId }, data: { featuredOrder: null } }),
            ...spotifyPlaylistIds.map((spotifyPlaylistId, index) => this.prisma.mofyPlaylist.updateMany({
                where: { userId, spotifyPlaylistId, removedAt: null },
                data: { featuredOrder: index },
            })),
        ]);
    }

    async setMofyPlaylistCover(userId: string, spotifyPlaylistId: string, coverUrl: string): Promise<void> {
        await this.prisma.mofyPlaylist.updateMany({ where: { userId, spotifyPlaylistId, removedAt: null }, data: { coverUrl } });
    }

    // Análise e dados das faixas das playlists (música mais forte, subgênero, % no humor).
    async getTracksForShowcase(spotifyIds: string[]) {
        const [analyses, tracks] = await Promise.all([
            this.prisma.tracksAnalysis.findMany({
                where: { spotifyid: { in: spotifyIds } },
                select: { spotifyid: true, emotionalVector: true, subgenre: true },
            }),
            this.prisma.track.findMany({
                where: { spotifyId: { in: spotifyIds } },
                select: { spotifyId: true, title: true, artist: true, img_url: true },
            }),
        ]);
        return { analyses, tracks };
    }

    // Playlists antigas ainda na conta do Mofy (de todos os usuários), das mais velhas.
    // As que estão no destaque de alguém ficam.
    async listExpiredMofyPlaylists(before: Date, take: number) {
        return this.prisma.mofyPlaylist.findMany({
            where: { createdAt: { lt: before }, removedAt: null, featuredOrder: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true, spotifyPlaylistId: true },
            take,
        });
    }

    async markMofyPlaylistRemoved(id: string): Promise<void> {
        await this.prisma.mofyPlaylist.update({ where: { id }, data: { removedAt: new Date() } });
    }

    async getUserTaste(userId: string): Promise<UserTaste> {
        const history = await this.prisma.listeningHistory.findMany({
            where: { userId },
            select: { track: { select: { spotifyId: true, artist: true } } },
        });

        const saved = await this.prisma.savedTrack.findMany({
            where: { userId },
            select: { track: { select: { spotifyId: true, artist: true } } },
        });

        const tasteTracks = [...history, ...saved].map(item => item.track);
        const tasteIds = new Set(tasteTracks.map(t => t.spotifyId).filter((id): id is string => Boolean(id)));

        const analyses = await this.prisma.tracksAnalysis.findMany({
            where: { spotifyid: { in: [...tasteIds] } },
            select: { subgenre: true },
        });

        return {
            tasteIds,
            savedIds: new Set(saved.map(s => s.track.spotifyId).filter((id): id is string => Boolean(id))),
            topArtists: this.rankByCount(tasteTracks.map(t => t.artist.split(', ')[0])),
            topSubgenres: this.rankByCount(analyses.map(a => a.subgenre).filter(sg => sg && sg !== 'Unknown')),
        };
    }

    // Todo o acervo analisado (de todos os usuários), já no formato de candidata.
    async getAnalyzedPool(tasteIds: Set<string>): Promise<JourneyCandidate[]> {
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
                fromUserHistory: tasteIds.has(analysis.spotifyid),
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
