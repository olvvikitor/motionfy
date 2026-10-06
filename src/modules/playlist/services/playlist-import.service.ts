import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { TrackRepository } from "src/modules/tracks/repository/TrackRepository";
import { SpotifyCatalogService } from "src/shared/infra/music/spotify/spotify-catalog.service";
import { PlaylistRepository } from "../repository/playlist.repository";
import { CandidateSourcingService } from "./candidate-sourcing.service";
import { MoodCentroidsService } from "./mood-centroids.service";
import { parsePlaylistLink, playlistMood, PlaylistMood } from "./playlist-import";

const MAX_TRACKS = 100;
// Faixas que o banco ainda não conhece: até tantas vêm completas do Spotify (capa do álbum, data); as outras
// entram só com título, artista e duração. O limite de chamadas é baixo e compartilhado.
const MAX_LOOKUPS = 40;
// Músicas novas lidas pelo Jev por playlist (1 chamada cada); o humor sai das analisadas.
const MAX_NEW_ANALYSES = 40;
const DAILY_IMPORTS = 5;
// Link curto do app do Spotify: só esses endereços são seguidos (a API não abre endereço qualquer).
const SHORT_LINK = /^https?:\/\/(spotify\.link|spotify\.app\.link)\/[A-Za-z0-9]+/;

export type ImportedPlaylistResponse = PlaylistMood & {
    id: string; // id do Mofy (baixar a capa)
    playlistId: string; // id no Spotify (gerar a capa)
    url: string;
    title: string;
    trackCount: number;
    analyzedCount: number;
    coverUrl: string | null;
};

// Playlist do próprio usuário no Spotify, trazida pelo link: as músicas são lidas pelo Jev, o humor sai
// delas e a playlist entra na Biblioteca (e no baralho do perfil). Não vai para a conta do Mofy: a capa
// gerada fica só no Mofy, para baixar. Trazer de novo a mesma playlist atualiza nome, músicas e humor.
@Injectable()
export class PlaylistImportService {
    constructor(
        private readonly repository: PlaylistRepository,
        private readonly catalog: SpotifyCatalogService,
        private readonly tracks: TrackRepository,
        private readonly sourcing: CandidateSourcingService,
        private readonly centroids: MoodCentroidsService,
    ) { }

    async import(userId: string, link: string): Promise<ImportedPlaylistResponse> {
        const playlistId = parsePlaylistLink(link) ?? parsePlaylistLink(await this.expandShortLink(link));
        if (!playlistId) throw new BadRequestException('Cole o link de uma playlist do Spotify (open.spotify.com/playlist/…).');

        const existing = await this.repository.findUserPlaylistBySpotifyId(userId, playlistId);
        if (existing && !existing.imported) throw new ConflictException('Essa playlist foi criada pelo Mofy e já está na sua biblioteca.');
        if (!existing && await this.repository.countMofyPlaylistsSince(userId, new Date(Date.now() - 24 * 60 * 60_000), true) >= DAILY_IMPORTS) {
            throw new HttpException(`Você já trouxe ${DAILY_IMPORTS} playlists hoje. Tente de novo amanhã.`, HttpStatus.TOO_MANY_REQUESTS);
        }

        const playlist = await this.catalog.getPlaylist(playlistId, MAX_TRACKS, MAX_LOOKUPS);
        if (!playlist) throw new NotFoundException('Não achei essa playlist. Ela precisa estar pública no Spotify.');
        if (!playlist.tracks.length) throw new HttpException('Essa playlist não tem músicas.', HttpStatus.UNPROCESSABLE_ENTITY);

        await this.tracks.saveTracks(playlist.tracks);
        const trackIds = playlist.tracks.map(t => t.spotifyId);
        const known = await this.repository.getAnalyzedCandidates(trackIds, new Set());
        const knownIds = new Set(known.map(c => c.spotifyId));
        const fresh = await this.sourcing.classifyAndSave(playlist.tracks.filter(t => !knownIds.has(t.spotifyId)).slice(0, MAX_NEW_ANALYSES));
        const analyzed = [...known, ...fresh];

        const mood = playlistMood(analyzed, await this.centroids.clusters());
        if (!mood) throw new HttpException('Não deu para ler o humor dessa playlist agora. Tente de novo em instantes.', HttpStatus.UNPROCESSABLE_ENTITY);

        const title = playlist.name.replace(/\s+/g, ' ').trim().slice(0, 100) || 'Minha playlist';
        const url = `https://open.spotify.com/playlist/${playlistId}`;
        const row = await this.repository.saveImportedPlaylist(existing?.id ?? null, {
            userId, spotifyPlaylistId: playlistId, url, title, sentiment: mood.sentiment, trackIds,
            tracksHash: createHash('sha1').update(trackIds.join(',')).digest('hex'),
        });

        return {
            ...mood,
            id: row.id,
            playlistId,
            url,
            title,
            trackCount: trackIds.length,
            analyzedCount: analyzed.length,
            coverUrl: row.coverUrl,
        };
    }

    // spotify.link/… (compartilhar do app no celular) redireciona para o link da playlist.
    private async expandShortLink(link: string): Promise<string> {
        const short = SHORT_LINK.exec(link.trim())?.[0];
        if (!short) return '';
        const response = await fetch(short, { redirect: 'follow', signal: AbortSignal.timeout(10_000) }).catch(() => null);
        if (!response) return '';
        // O link curto às vezes cai numa página que só cita o link de verdade no HTML.
        return parsePlaylistLink(response.url) ? response.url : (await response.text().catch(() => '')).slice(0, 200_000);
    }
}
