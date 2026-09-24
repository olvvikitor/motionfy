import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import SaveTracks from "src/modules/tracks/services/saveTracks";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { LibraryPlaylist, MusicProviderInterface } from "src/shared/infra/music/music.provider.interface";
import { TrackInput } from "src/shared/types/TrackInput";
import { LIKED_SOURCE, LibrarySelectionDto } from "../dtos/library.dto";
import { LibraryRepository } from "../repository/library.repository";

const SOURCE_TRACKS_MAX = 500; // por origem
const SOURCE_CACHE_TTL_MS = 20 * 60 * 1000;

export type LibrarySourcesResponse = {
    liked: { total: number };
    playlists: LibraryPlaylist[];
    hiddenPlaylists: number;
    libraryCount: number;
};

export type SourceTrack = {
    spotifyId: string;
    title: string;
    artist: string;
    imgUrl: string;
    durationMs: number | null;
    inLibrary: boolean;
};

// Biblioteca do usuário: nada é puxado sozinho. O usuário abre as curtidas ou uma playlist,
// escolhe as músicas e salva. Só o que foi escolhido entra (e depois é analisado pelo Jev).
@Injectable()
export class LibraryService {
    // Lista que o usuário acabou de ver: evita buscar de novo no Spotify ao salvar.
    private readonly sourceCache = new Map<string, { at: number; tracks: TrackInput[] }>();

    constructor(
        private readonly repository: LibraryRepository,
        private readonly providers: MusicProviderFactory,
        private readonly saveTracks: SaveTracks,
    ) { }

    async sources(userId: string): Promise<LibrarySourcesResponse> {
        const { provider, accessToken } = await this.connect(userId);
        const [sources, libraryCount] = await Promise.all([
            provider.getLibrarySources!(accessToken),
            this.repository.count(userId),
        ]);
        return {
            liked: { total: sources.likedTotal },
            playlists: sources.playlists,
            hiddenPlaylists: sources.hiddenPlaylists,
            libraryCount,
        };
    }

    async sourceTracks(userId: string, source: string): Promise<{ tracks: SourceTrack[]; truncated: boolean }> {
        const tracks = await this.fetchSource(userId, source, true);
        const inLibrary = await this.repository.findInLibrary(userId, tracks.map((t) => t.spotifyId));
        return {
            tracks: tracks.map((t) => ({
                spotifyId: t.spotifyId,
                title: t.title,
                artist: t.artist,
                imgUrl: t.img_url,
                durationMs: t.durationMs ?? null,
                inLibrary: inLibrary.has(t.spotifyId),
            })),
            truncated: tracks.length >= SOURCE_TRACKS_MAX,
        };
    }

    async add(userId: string, items: LibrarySelectionDto[]): Promise<{ added: number; libraryCount: number }> {
        const chosen = new Map<string, TrackInput>();
        for (const item of items) {
            const wanted = new Set(item.spotifyIds);
            const tracks = await this.fetchSource(userId, item.source, false);
            for (const track of tracks) {
                if (wanted.has(track.spotifyId) && !chosen.has(track.spotifyId)) chosen.set(track.spotifyId, track);
            }
        }
        if (!chosen.size) throw new BadRequestException('Nenhuma das músicas escolhidas foi encontrada. Recarregue a lista.');

        const before = await this.repository.count(userId);
        const saved = await this.saveTracks.addLibraryTracks(userId, [...chosen.values()]);
        const libraryCount = await this.repository.count(userId);

        // Análise em segundo plano: pode levar minutos com muitas músicas novas.
        this.saveTracks.analyzeLibraryTracks(userId, saved)
            .catch((error) => console.error(`[Library] user=${userId} análise falhou:`, error?.message ?? error));

        return { added: libraryCount - before, libraryCount };
    }

    async list(userId: string) {
        const tracks = await this.repository.list(userId);
        return { total: await this.repository.count(userId), tracks };
    }

    async remove(userId: string, spotifyId: string): Promise<{ libraryCount: number }> {
        const removed = await this.repository.remove(userId, spotifyId);
        if (!removed) throw new NotFoundException('Essa música não está na sua biblioteca.');
        return { libraryCount: await this.repository.count(userId) };
    }

    private async fetchSource(userId: string, source: string, fresh: boolean): Promise<TrackInput[]> {
        const key = `${userId}:${source}`;
        const cached = this.sourceCache.get(key);
        if (!fresh && cached && Date.now() - cached.at < SOURCE_CACHE_TTL_MS) return cached.tracks;

        const { provider, accessToken } = await this.connect(userId);
        const tracks = source === LIKED_SOURCE
            ? await provider.getSavedTracks!(accessToken, SOURCE_TRACKS_MAX)
            : await provider.getPlaylistTracks!(accessToken, source, SOURCE_TRACKS_MAX);

        this.pruneCache();
        this.sourceCache.set(key, { at: Date.now(), tracks });
        return tracks;
    }

    private pruneCache(): void {
        const now = Date.now();
        for (const [key, entry] of this.sourceCache) {
            if (now - entry.at >= SOURCE_CACHE_TTL_MS) this.sourceCache.delete(key);
        }
    }

    private async connect(userId: string): Promise<{ provider: MusicProviderInterface; accessToken: string }> {
        const user = await this.repository.getUser(userId);
        if (!user) throw new NotFoundException('Usuário não encontrado');

        const provider = this.providers.getProvider(user.provider);
        if (!provider.getLibrarySources || !provider.getPlaylistTracks || !provider.getSavedTracks) {
            throw new BadRequestException('A biblioteca está disponível só para contas do Spotify.');
        }
        const accessToken = await provider.refreshToken(user.refreshToken!);
        return { provider, accessToken };
    }
}
