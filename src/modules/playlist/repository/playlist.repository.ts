import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/config/prisma.service";
import { EMOTIONAL_DIMENSIONS } from "src/shared/infra/IA/emotion-analysis.service";
import { JourneyCandidate, Vector } from "../services/journey-path";

const POOL_LIMIT = 5000;
const TASTE_CHUNK = 1000;
const ANALYSIS_SELECT = { spotifyid: true, emotionalVector: true, dominantSentiment: true, genre: true, subgenre: true, bpm: true } as const;

export type UserTaste = {
    // Faixas que o usuário ouviu ou curtiu — recebem preferência na jornada.
    tasteIds: Set<string>;
    savedIds: Set<string>;
    topArtists: string[]; // artista principal, dos mais ouvidos aos menos
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

    // Sugestões ao usuário desde `since`, uma linha por vez sugerida (para o cansaço).
    async getSuggestionHistory(userId: string, since: Date): Promise<{ spotifyId: string; suggestedAt: Date }[]> {
        return this.prisma.playlistSuggestion.findMany({
            where: { userId, suggestedAt: { gte: since } },
            select: { spotifyId: true, suggestedAt: true },
        });
    }

    // Grava a sugestão nova e apaga as que já saíram da janela (não servem mais para nada).
    async saveSuggestions(userId: string, spotifyIds: string[], pruneBefore: Date): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.playlistSuggestion.deleteMany({ where: { userId, suggestedAt: { lt: pruneBefore } } }),
            this.prisma.playlistSuggestion.createMany({ data: spotifyIds.map(spotifyId => ({ userId, spotifyId })) }),
        ]);
    }

    // Mesma lista criada há pouco (clique repetido). Só dentro de `since`: depois disso, lista
    // igual vira playlist nova, senão título, humor e capa da antiga seriam sobrescritos.
    async findRecentMofyPlaylist(userId: string, tracksHash: string, since: Date) {
        return this.prisma.mofyPlaylist.findFirst({
            where: { userId, tracksHash, removedAt: null, createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Só quem criou a playlist pode mudar a capa dela.
    async findOwnedMofyPlaylist(userId: string, spotifyPlaylistId: string) {
        return this.prisma.mofyPlaylist.findFirst({ where: { userId, spotifyPlaylistId, removedAt: null }, select: { id: true, sentiment: true, title: true, trackIds: true } });
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
        title: string; sentiment: string | null; fromSentiment: string | null; trackIds: string[];
    }): Promise<void> {
        await this.prisma.mofyPlaylist.create({ data });
    }

    // Todas as playlists do usuário, também as que já saíram da conta do Mofy no Spotify.
    async countMofyPlaylists(userId: string): Promise<number> {
        return this.prisma.mofyPlaylist.count({ where: { userId } });
    }

    // Uma página das playlists do usuário (também as que já saíram do Spotify), das mais novas.
    // `cursor` = id da última da página anterior. Traz uma a mais para saber se há próxima página.
    async listMofyPlaylistsPage(userId: string, take: number, cursor?: string) {
        return this.prisma.mofyPlaylist.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: take + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true, spotifyPlaylistId: true, url: true, title: true, sentiment: true, fromSentiment: true,
                trackIds: true, coverUrl: true, createdAt: true, removedAt: true,
            },
        });
    }

    // Playlist do usuário pelo id do Mofy, mesmo a que já saiu do Spotify (para gerar de novo).
    async findUserMofyPlaylist(userId: string, id: string) {
        return this.prisma.mofyPlaylist.findFirst({
            where: { id, userId },
            select: { id: true, spotifyPlaylistId: true, url: true, title: true, trackIds: true, coverUrl: true, removedAt: true },
        });
    }

    // Gerada de novo no Spotify: a mesma linha passa a apontar para a playlist nova e o prazo na
    // conta do Mofy recomeça (conta também no limite do dia).
    async reviveMofyPlaylist(id: string, spotifyPlaylistId: string, url: string): Promise<void> {
        await this.prisma.mofyPlaylist.update({ where: { id }, data: { spotifyPlaylistId, url, removedAt: null, createdAt: new Date() } });
    }

    // Playlists do usuário com capa guardada, das mais novas (capas para reaproveitar).
    async listUserCovers(userId: string, take: number) {
        return this.prisma.mofyPlaylist.findMany({
            where: { userId, coverUrl: { not: null } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take,
            select: { id: true, coverUrl: true, title: true, sentiment: true },
        });
    }

    async setMofyPlaylistCover(userId: string, spotifyPlaylistId: string, coverUrl: string): Promise<void> {
        await this.prisma.mofyPlaylist.updateMany({ where: { userId, spotifyPlaylistId, removedAt: null }, data: { coverUrl } });
    }

    // Análise e dados das faixas das playlists (música mais forte, subgênero, % no humor; contexto da capa gerada).
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
    async listExpiredMofyPlaylists(before: Date, take: number) {
        return this.prisma.mofyPlaylist.findMany({
            where: { createdAt: { lt: before }, removedAt: null },
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

        return {
            tasteIds,
            savedIds: new Set(saved.map(s => s.track.spotifyId).filter((id): id is string => Boolean(id))),
            topArtists: this.rankByCount(tasteTracks.map(t => t.artist.split(', ')[0])),
        };
    }

    // País já consultado de cada artista (nome em minúsculas → país, ou null se ninguém soube dizer).
    // Artista fora do mapa = ainda não consultado.
    async getArtistCountries(names: string[]): Promise<Map<string, string | null>> {
        if (!names.length) return new Map();
        const chunks = Array.from({ length: Math.ceil(names.length / TASTE_CHUNK) }, (_, i) => names.slice(i * TASTE_CHUNK, (i + 1) * TASTE_CHUNK));
        const rows = (await Promise.all(chunks.map(chunk => this.prisma.artistInfo.findMany({
            where: { name: { in: chunk } },
            select: { name: true, country: true },
        })))).flat();
        return new Map(rows.map(r => [r.name, r.country]));
    }

    async saveArtistCountry(name: string, country: string | null, source: string): Promise<void> {
        await this.prisma.artistInfo.upsert({
            where: { name },
            create: { name, country, source },
            update: { country, source, checkedAt: new Date() },
        });
    }

    // Gênero, subgênero e BPM das músicas do usuário: opções dos filtros da playlist.
    async getTasteFacetRows(tasteIds: Set<string>) {
        const ids = [...tasteIds];
        const chunks = Array.from({ length: Math.ceil(ids.length / TASTE_CHUNK) }, (_, i) => ids.slice(i * TASTE_CHUNK, (i + 1) * TASTE_CHUNK));
        return (await Promise.all(chunks.map(chunk => this.prisma.tracksAnalysis.findMany({
            where: { spotifyid: { in: chunk } },
            select: { genre: true, subgenre: true, bpm: true },
        })))).flat();
    }

    // Acervo analisado: as POOL_LIMIT mais recentes (de todos os usuários) + todas as do usuário,
    // senão as curtidas antigas sumiriam quando o acervo passasse do limite.
    async getAnalyzedPool(tasteIds: Set<string>): Promise<JourneyCandidate[]> {
        const recent = await this.prisma.tracksAnalysis.findMany({ select: ANALYSIS_SELECT, orderBy: { analyzedAt: 'desc' }, take: POOL_LIMIT });
        const recentIds = new Set(recent.map(a => a.spotifyid));
        const missing = [...tasteIds].filter(id => !recentIds.has(id));
        const chunks = Array.from({ length: Math.ceil(missing.length / TASTE_CHUNK) }, (_, i) => missing.slice(i * TASTE_CHUNK, (i + 1) * TASTE_CHUNK));
        const tasteAnalyses = (await Promise.all(chunks.map(ids => this.prisma.tracksAnalysis.findMany({ where: { spotifyid: { in: ids } }, select: ANALYSIS_SELECT })))).flat();
        return this.toCandidates([...recent, ...tasteAnalyses], tasteIds);
    }

    // Músicas já analisadas entre `spotifyIds` (as populares buscadas fora do acervo): não passam pelo Jev de novo.
    async getAnalyzedCandidates(spotifyIds: string[], tasteIds: Set<string>): Promise<JourneyCandidate[]> {
        if (!spotifyIds.length) return [];
        const analyses = await this.prisma.tracksAnalysis.findMany({ where: { spotifyid: { in: spotifyIds } }, select: ANALYSIS_SELECT });
        return this.toCandidates(analyses, tasteIds);
    }

    private async toCandidates(
        analyses: { spotifyid: string; emotionalVector: unknown; dominantSentiment: string; genre: string | null; subgenre: string | null; bpm: number | null }[],
        tasteIds: Set<string>,
    ): Promise<JourneyCandidate[]> {
        const tracks = await this.prisma.track.findMany({
            where: { spotifyId: { in: analyses.map(a => a.spotifyid) } },
            select: { spotifyId: true, title: true, artist: true, img_url: true, durationMs: true, isrc: true },
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
                genre: analysis.genre,
                subgenre: analysis.subgenre,
                bpm: analysis.bpm,
                isrc: track.isrc,
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
