import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { EMOTIONAL_DIMENSIONS, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { SpotifyMofyAccountService } from "src/shared/infra/music/spotify/spotify-mofy-account.service";
import { SpotifyPlaylistDto } from "../dtos/journey-playlist.dto";
import { PlaylistRepository } from "../repository/playlist.repository";
import { Vector } from "./journey-path";
import { defaultFeatured, showcaseStats, ShowcaseStats } from "./playlist-showcase";

const DAILY_LIMIT = 10; // por usuário: a conta do Mofy é uma só para todos
const KEEP_DAYS = 30; // depois disso a playlist sai do perfil do Mofy (quem salvou continua com ela)
const PRUNE_BATCH = 20;
export const FEATURED_LIMIT = 5;
const DESCRIPTION = 'Montada pelo Mofy a partir do humor das suas músicas.';

export type MofyPlaylistResponse = { url: string; playlistId: string; reused: boolean };

export type ShowcasePlaylist = ShowcaseStats & {
    playlistId: string;
    url: string;
    title: string;
    sentiment: string | null;
    fromSentiment: string | null;
    coverUrl: string | null;
    trackCount: number;
    createdAt: Date;
};

export type ShowcaseResponse = {
    // O que aparece no perfil, na ordem (até 5). customized = o usuário escolheu.
    featured: string[];
    customized: boolean;
    playlists: ShowcasePlaylist[];
};

// Playlist pronta no Spotify para qualquer usuário (Spotify ou Last.fm): criada na conta
// do Mofy, o usuário recebe o link e pode tocar, salvar ou seguir. As criadas também
// alimentam o destaque do perfil (até 5, escolhidas pelo usuário).
@Injectable()
export class MofyPlaylistService {
    constructor(
        private readonly repository: PlaylistRepository,
        private readonly account: SpotifyMofyAccountService,
    ) { }

    async create(userId: string, dto: SpotifyPlaylistDto): Promise<MofyPlaylistResponse> {
        if (!this.account.isConfigured()) {
            throw new HttpException('Criar playlist no Spotify ainda não está disponível.', HttpStatus.SERVICE_UNAVAILABLE);
        }

        // Mesma lista na mesma ordem: devolve o link que já existe (clicar de novo não cria outra).
        const tracksHash = createHash('sha1').update(dto.trackIds.join(',')).digest('hex');
        const existing = await this.repository.findMofyPlaylist(userId, tracksHash);
        if (existing) return { url: existing.url, playlistId: existing.spotifyPlaylistId, reused: true };

        const since = new Date(Date.now() - 24 * 60 * 60_000);
        if (await this.repository.countMofyPlaylistsSince(userId, since) >= DAILY_LIMIT) {
            throw new HttpException(`Você já criou ${DAILY_LIMIT} playlists hoje. Tente de novo amanhã.`, HttpStatus.TOO_MANY_REQUESTS);
        }

        const title = dto.title.replace(/\s+/g, ' ').trim();
        const playlist = await this.account.createPlaylist(`Mofy · ${title}`.slice(0, 100), DESCRIPTION, dto.trackIds);
        await this.repository.saveMofyPlaylist({
            userId, spotifyPlaylistId: playlist.id, url: playlist.url, tracksHash,
            title, sentiment: dto.sentiment ?? null, fromSentiment: dto.fromSentiment ?? null,
            trackIds: dto.trackIds, featuredOrder: null,
        });

        // Limpeza em segundo plano: não atrasa a resposta.
        this.pruneExpired().catch(err => console.error('[MofyPlaylist] limpeza falhou:', err?.message ?? err));

        return { url: playlist.url, playlistId: playlist.id, reused: false };
    }

    // Todas as playlists do usuário com os dados do card, e quais vão para o destaque.
    // Sem escolha do usuário, o destaque são as mais novas, uma por humor.
    async showcase(userId: string): Promise<ShowcaseResponse> {
        const rows = await this.repository.listMofyPlaylists(userId);
        const trackIdsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
        const allIds = [...new Set(rows.flatMap(r => trackIdsOf(r.trackIds)))];
        const { analyses, tracks } = allIds.length ? await this.repository.getTracksForShowcase(allIds) : { analyses: [], tracks: [] };
        const analysisById = new Map(analyses.map(a => [a.spotifyid, a]));
        const trackById = new Map(tracks.map(t => [t.spotifyId, t]));

        const playlists: ShowcasePlaylist[] = rows.map(row => {
            const ids = trackIdsOf(row.trackIds);
            const items = ids.flatMap(id => {
                const track = trackById.get(id);
                if (!track) return [];
                const analysis = analysisById.get(id);
                return [{
                    spotifyId: id,
                    title: track.title,
                    artist: track.artist,
                    imgUrl: track.img_url ?? '',
                    vector: toVector(analysis?.emotionalVector),
                    subgenre: analysis?.subgenre ?? null,
                }];
            });
            return {
                playlistId: row.spotifyPlaylistId,
                url: row.url,
                title: row.title ?? 'Playlist do Mofy',
                sentiment: row.sentiment,
                fromSentiment: row.fromSentiment,
                coverUrl: row.coverUrl,
                trackCount: ids.length,
                createdAt: row.createdAt,
                ...showcaseStats(row.sentiment ? getClusterVector(row.sentiment) ?? null : null, items),
            };
        });

        const chosen = rows
            .filter(r => r.featuredOrder !== null)
            .sort((a, b) => a.featuredOrder! - b.featuredOrder!)
            .map(r => r.spotifyPlaylistId);
        const featured = chosen.length ? chosen : defaultFeatured(playlists, FEATURED_LIMIT).map(p => p.playlistId);

        return { featured, customized: chosen.length > 0, playlists };
    }

    async setFeatured(userId: string, playlistIds: string[]): Promise<ShowcaseResponse> {
        await this.repository.setFeaturedMofyPlaylists(userId, [...new Set(playlistIds)].slice(0, FEATURED_LIMIT));
        return this.showcase(userId);
    }

    // Tira do perfil do Mofy as playlists com mais de KEEP_DAYS dias (menos as do destaque).
    private async pruneExpired(): Promise<void> {
        const before = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60_000);
        for (const old of await this.repository.listExpiredMofyPlaylists(before, PRUNE_BATCH)) {
            await this.account.removePlaylist(old.spotifyPlaylistId)
                .catch(err => console.error(`[MofyPlaylist] não removeu ${old.spotifyPlaylistId}:`, err?.message ?? err));
            await this.repository.markMofyPlaylistRemoved(old.id);
        }
    }
}

function toVector(value: unknown): Vector | null {
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
