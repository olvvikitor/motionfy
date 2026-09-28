import { HttpException, HttpStatus, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createHash } from "crypto";
import { EMOTIONAL_DIMENSIONS, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { SpotifyMofyAccountService } from "src/shared/infra/music/spotify/spotify-mofy-account.service";
import { SpotifyPlaylistDto } from "../dtos/journey-playlist.dto";
import { PlaylistRepository } from "../repository/playlist.repository";
import { Vector } from "./journey-path";
import { fetchCover, toSpotifyCover } from "./playlist-cover.service";
import { showcaseStats, ShowcaseStats } from "./playlist-showcase";

const DAILY_LIMIT = 10; // por usuário: a conta do Mofy é uma só para todos
// A conta do Mofy no Spotify é uma só para todos: cada playlist fica lá só por 1 dia e sempre é apagada
// (quem salvou/seguiu continua com ela). No Mofy ela fica para sempre e pode ser gerada de novo.
const KEEP_MS = 24 * 60 * 60_000;
const PRUNE_EVERY_MS = 15 * 60_000;
const PRUNE_BATCH = 20;
const REUSE_WINDOW_MS = 10 * 60_000; // só protege contra clique repetido
export const PAGE_SIZE = 10;
const DESCRIPTION = 'Montada pelo Mofy a partir do humor das suas músicas.';

export type MofyPlaylistResponse = { url: string; playlistId: string; reused: boolean };

export type ShowcasePlaylist = ShowcaseStats & {
    id: string; // id do Mofy (gerar de novo)
    playlistId: string;
    url: string;
    onSpotify: boolean; // false = já saiu da conta do Mofy: sem link, dá para gerar de novo
    title: string;
    sentiment: string | null;
    fromSentiment: string | null;
    coverUrl: string | null;
    trackCount: number;
    createdAt: Date;
};

// Biblioteca: todas as playlists já criadas, com as músicas guardadas no Mofy (não depende do Spotify).
export type LibraryPlaylist = {
    id: string;
    title: string;
    sentiment: string | null;
    fromSentiment: string | null;
    coverUrl: string | null;
    createdAt: Date;
    tracks: { spotifyId: string; title: string; artist: string; imgUrl: string }[];
};

export type LibraryPlaylistsResponse = {
    playlists: LibraryPlaylist[];
    nextCursor: string | null;
    total: number | null; // só na primeira página
};

export type ShowcaseResponse = {
    playlists: ShowcasePlaylist[];
    nextCursor: string | null;
    total: number | null; // só na primeira página
};

// Playlist pronta no Spotify para qualquer usuário (Spotify ou Last.fm): criada na conta
// do Mofy, o usuário recebe o link e pode tocar, salvar ou seguir (fica lá 1 dia). As criadas aparecem
// todas no perfil (paginadas).
@Injectable()
export class MofyPlaylistService implements OnModuleInit, OnModuleDestroy {
    private pruneTimer: NodeJS.Timeout | null = null;
    private pruning = false;

    constructor(
        private readonly repository: PlaylistRepository,
        private readonly account: SpotifyMofyAccountService,
    ) { }

    // Limpeza periódica (além da que roda a cada criação): sem ela, sem novas criações nada sairia.
    onModuleInit(): void {
        if (!this.account.isConfigured()) return;
        const run = () => this.pruneExpired().catch(err => console.error('[MofyPlaylist] limpeza falhou:', err?.message ?? err));
        run();
        this.pruneTimer = setInterval(run, PRUNE_EVERY_MS);
        this.pruneTimer.unref();
    }

    onModuleDestroy(): void {
        if (this.pruneTimer) clearInterval(this.pruneTimer);
    }

    async create(userId: string, dto: SpotifyPlaylistDto): Promise<MofyPlaylistResponse> {
        this.assertConfigured();

        // Clique repetido (mesma lista, na mesma ordem, há poucos minutos): devolve a que acabou de ser
        // criada. Fora dessa janela cada criação é uma playlist nova, com id próprio.
        const tracksHash = createHash('sha1').update(dto.trackIds.join(',')).digest('hex');
        const existing = await this.repository.findRecentMofyPlaylist(userId, tracksHash, new Date(Date.now() - REUSE_WINDOW_MS));
        if (existing) return { url: existing.url, playlistId: existing.spotifyPlaylistId, reused: true };

        await this.assertUnderDailyLimit(userId);

        const title = dto.title.replace(/\s+/g, ' ').trim();
        const playlist = await this.account.createPlaylist(`Mofy · ${title}`.slice(0, 100), DESCRIPTION, dto.trackIds);
        await this.repository.saveMofyPlaylist({
            userId, spotifyPlaylistId: playlist.id, url: playlist.url, tracksHash,
            title, sentiment: dto.sentiment ?? null, fromSentiment: dto.fromSentiment ?? null,
            trackIds: dto.trackIds,
        });

        // Limpeza em segundo plano: não atrasa a resposta.
        this.pruneExpired().catch(err => console.error('[MofyPlaylist] limpeza falhou:', err?.message ?? err));

        return { url: playlist.url, playlistId: playlist.id, reused: false };
    }

    // Playlists do usuário com os dados do card, das mais novas, uma página por vez (só a página
    // busca faixas e análises). nextCursor null = acabou.
    async showcase(userId: string, cursor?: string, limit = PAGE_SIZE): Promise<ShowcaseResponse> {
        const [page, total] = await Promise.all([
            this.repository.listMofyPlaylistsPage(userId, limit, cursor),
            cursor ? Promise.resolve(null) : this.repository.countMofyPlaylists(userId),
        ]);
        const rows = page.slice(0, limit);
        const nextCursor = page.length > limit ? rows[rows.length - 1].id : null;
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
                id: row.id,
                playlistId: row.spotifyPlaylistId,
                url: row.url,
                onSpotify: !row.removedAt,
                title: row.title ?? 'Playlist do Mofy',
                sentiment: row.sentiment,
                fromSentiment: row.fromSentiment,
                coverUrl: row.coverUrl,
                trackCount: ids.length,
                createdAt: row.createdAt,
                ...showcaseStats(row.sentiment ? getClusterVector(row.sentiment) ?? null : null, items),
            };
        });

        return { playlists, nextCursor, total };
    }

    // Biblioteca: todas as playlists do usuário (também as que já saíram do Spotify), das mais novas,
    // com as músicas guardadas no Mofy. nextCursor null = acabou.
    async library(userId: string, cursor?: string, limit = PAGE_SIZE): Promise<LibraryPlaylistsResponse> {
        const [page, total] = await Promise.all([
            this.repository.listMofyPlaylistsPage(userId, limit, cursor),
            cursor ? Promise.resolve(null) : this.repository.countMofyPlaylists(userId),
        ]);
        const rows = page.slice(0, limit);
        const nextCursor = page.length > limit ? rows[rows.length - 1].id : null;
        const allIds = [...new Set(rows.flatMap(r => trackIdsOf(r.trackIds)))];
        const tracks = allIds.length ? (await this.repository.getTracksForShowcase(allIds)).tracks : [];
        const trackById = new Map(tracks.map(t => [t.spotifyId, t]));

        const playlists: LibraryPlaylist[] = rows.map(row => ({
            id: row.id,
            title: row.title ?? 'Playlist do Mofy',
            sentiment: row.sentiment,
            fromSentiment: row.fromSentiment,
            coverUrl: row.coverUrl,
            createdAt: row.createdAt,
            tracks: trackIdsOf(row.trackIds).flatMap(id => {
                const track = trackById.get(id);
                return track ? [{ spotifyId: id, title: track.title, artist: track.artist, imgUrl: track.img_url ?? '' }] : [];
            }),
        }));

        return { playlists, nextCursor, total };
    }

    // "Abrir no Spotify" do perfil: confere se a playlist ainda está na conta do Mofy; se não estiver,
    // gera de novo (mesmas músicas, título e capa) e devolve o link novo. Sem resposta do Spotify, abre a guardada.
    async open(userId: string, id: string): Promise<MofyPlaylistResponse> {
        const row = await this.repository.findUserMofyPlaylist(userId, id);
        if (!row) throw new NotFoundException('Playlist não encontrada.');
        if (!row.removedAt) {
            if (await this.account.isFollowing(row.spotifyPlaylistId) !== false) {
                return { url: row.url, playlistId: row.spotifyPlaylistId, reused: true };
            }
            await this.repository.markMofyPlaylistRemoved(row.id);
        }
        return await this.recreate(userId, id);
    }

    // Gera de novo no Spotify (esteja ela lá ou não): mesmas músicas, título e capa. A linha é a mesma
    // (vai para o topo, com prazo novo); a cópia antiga, se ainda estiver na conta do Mofy, sai de lá.
    async recreate(userId: string, id: string): Promise<MofyPlaylistResponse> {
        const row = await this.repository.findUserMofyPlaylist(userId, id);
        if (!row) throw new NotFoundException('Playlist não encontrada.');

        const trackIds = trackIdsOf(row.trackIds);
        if (!trackIds.length) throw new HttpException('Essa playlist não tem músicas guardadas para gerar de novo.', HttpStatus.UNPROCESSABLE_ENTITY);
        this.assertConfigured();
        await this.assertUnderDailyLimit(userId);

        const title = row.title ?? 'Playlist do Mofy';
        const playlist = await this.account.createPlaylist(`Mofy · ${title}`.slice(0, 100), DESCRIPTION, trackIds);
        await this.repository.reviveMofyPlaylist(row.id, playlist.id, playlist.url);

        if (!row.removedAt) {
            this.account.removePlaylist(row.spotifyPlaylistId)
                .catch(err => console.error(`[MofyPlaylist] não removeu a cópia antiga ${row.spotifyPlaylistId}:`, err?.message ?? err));
        }

        // Capa guardada no Mofy (enviada ou gerada pela IA) volta para o Spotify antes do link sair, para a
        // playlist já abrir com ela. Se falhar, segue com o mosaico do Spotify.
        if (row.coverUrl) {
            await this.restoreCover(playlist.id, row.coverUrl)
                .catch(err => console.error(`[MofyPlaylist] capa não voltou para ${playlist.id}:`, err?.message ?? err));
        }
        this.pruneExpired().catch(err => console.error('[MofyPlaylist] limpeza falhou:', err?.message ?? err));

        return { url: playlist.url, playlistId: playlist.id, reused: false };
    }

    private async restoreCover(spotifyPlaylistId: string, coverUrl: string): Promise<void> {
        await this.account.setCover(spotifyPlaylistId, await toSpotifyCover(await fetchCover(coverUrl)));
    }

    private assertConfigured(): void {
        if (!this.account.isConfigured()) {
            throw new HttpException('Criar playlist no Spotify ainda não está disponível.', HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private async assertUnderDailyLimit(userId: string): Promise<void> {
        const since = new Date(Date.now() - 24 * 60 * 60_000);
        if (await this.repository.countMofyPlaylistsSince(userId, since) >= DAILY_LIMIT) {
            throw new HttpException(`Você já criou ${DAILY_LIMIT} playlists hoje. Tente de novo amanhã.`, HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    // Apaga da conta do Mofy no Spotify as playlists com mais de 1 dia, em lotes, até acabar. Uma limpeza
    // por vez (a periódica e a da criação não se atropelam).
    private async pruneExpired(): Promise<void> {
        if (this.pruning) return;
        this.pruning = true;
        try {
            const before = new Date(Date.now() - KEEP_MS);
            for (;;) {
                const batch = await this.repository.listExpiredMofyPlaylists(before, PRUNE_BATCH);
                for (const old of batch) {
                    try {
                        await this.account.removePlaylist(old.spotifyPlaylistId);
                    } catch (err) {
                        // Limite do Spotify: para e tenta na próxima rodada, sem marcar como apagada.
                        if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) return;
                        // Outro erro (ex.: já não existe): registra e segue, para não travar a fila.
                        console.error(`[MofyPlaylist] não removeu ${old.spotifyPlaylistId}:`, err instanceof Error ? err.message : err);
                    }
                    await this.repository.markMofyPlaylistRemoved(old.id);
                }
                if (batch.length < PRUNE_BATCH) break;
            }
        } finally {
            this.pruning = false;
        }
    }
}

function trackIdsOf(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
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
