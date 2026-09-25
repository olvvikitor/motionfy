import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { AiTextService } from "src/shared/infra/IA/AiText.service";
import { EMOTION_CLUSTERS, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { MusicProviderInterface } from "src/shared/infra/music/music.provider.interface";
import { JourneyPathQueryDto, JourneyPlaylistDto, JourneySource, QueueJourneyDto } from "../dtos/journey-playlist.dto";
import { PlaylistRepository, UserTaste } from "../repository/playlist.repository";
import { CandidateSourcingService } from "./candidate-sourcing.service";
import { buildJourney, buildPath, distance, findGaps, NEAR_RADIUS, waypointsAlong, JourneyCandidate, stopCountForDuration, totalDurationMs, trackDuration, Vector } from "./journey-path";

export type JourneyPlaylistResponse = {
    from: string;
    to: string;
    durationMin: number;
    source: JourneySource;
    request?: string;
    // Só no modo "custom": de onde veio o sentimento de partida que o Jev usou.
    fromOrigin?: JourneyFromOrigin;
    totalDurationMs: number;
    newTracksAnalyzed: number;
    tracks: {
        position: number;
        spotifyId: string;
        title: string;
        artist: string;
        imgUrl: string;
        durationMs: number;
        dominantSentiment: string;
        progress: number; // 0 = sentimento de partida, 1 = sentimento de chegada
        approximate: boolean;
    }[];
};

// Janela em que uma música sugerida é evitada nas próximas playlists.
const RECENT_SUGGESTION_DAYS = 7;

export type JourneyFromOrigin = 'request' | 'current_mood' | 'jev_guess';

export type JourneyQueueResponse = {
    requested: number;
    queued: number;
    queueError?: string;
};

type ResolvedJourney = {
    from: string;
    to: string;
    fromOrigin?: JourneyFromOrigin;
    // Modo custom com estilo pedido: só entram músicas que o Jev confirmar que são desse estilo.
    style?: { request: string; genre: string | null };
};

@Injectable()
export class JourneyPlaylistService {
    constructor(
        private readonly repository: PlaylistRepository,
        private readonly sourcing: CandidateSourcingService,
        private readonly providers: MusicProviderFactory,
        private readonly aiText: AiTextService,
    ) { }

    // Só sugere as músicas. Nada vai para a fila até o usuário revisar e chamar queue().
    async build(userId: string, dto: JourneyPlaylistDto): Promise<JourneyPlaylistResponse> {
        const journey = await this.resolveJourney(userId, dto);

        const user = await this.repository.getUser(userId);
        if (!user) throw new NotFoundException('Usuário não encontrado');

        const provider = this.providers.getProvider(user.provider);
        // Last.fm também sugere (busca no catálogo do Spotify); só a fila exige login do Spotify.
        if (!provider.searchTracks) {
            throw new BadRequestException('Playlist de jornada disponível apenas para contas do Spotify ou Last.fm.');
        }

        const from = getClusterVector(journey.from)!;
        const to = getClusterVector(journey.to)!;
        const accessToken = await provider.refreshToken(user.refreshToken!);

        const taste = await this.repository.getUserTaste(userId);
        const pool = await this.repository.getAnalyzedPool(taste.tasteIds);
        const since = new Date(Date.now() - RECENT_SUGGESTION_DAYS * 86_400_000);
        const recentIds = await this.repository.getRecentSuggestionIds(userId, since);

        const { candidates, newTracksAnalyzed } = await this.collectCandidates(dto, journey, { from, to, pool, taste, provider, accessToken, recentIds });

        // Sorteia entre as 3 mais próximas de cada parada e rebaixa as já sugeridas nos últimos
        // dias: o mesmo pedido gera playlists diferentes em vez de repetir as mesmas músicas.
        const picks = buildJourney(from, to, dto.durationMin, candidates, { randomTopK: 3, recentIds });
        if (!picks.length) throw new UnprocessableEntityException(this.emptyMessage(dto));

        await this.repository.saveSuggestions(userId, picks.map(p => p.candidate.spotifyId), since);

        const lastStop = Math.max(1, picks[picks.length - 1].stop);

        return {
            from: journey.from,
            to: journey.to,
            durationMin: dto.durationMin,
            source: dto.source,
            request: dto.source === 'custom' ? dto.request : undefined,
            fromOrigin: journey.fromOrigin,
            totalDurationMs: totalDurationMs(picks),
            newTracksAnalyzed,
            tracks: picks.map((pick, index) => ({
                position: index + 1,
                spotifyId: pick.candidate.spotifyId,
                title: pick.candidate.title,
                artist: pick.candidate.artist,
                imgUrl: pick.candidate.imgUrl,
                durationMs: trackDuration(pick.candidate),
                dominantSentiment: pick.candidate.dominantSentiment,
                progress: pick.stop / lastStop,
                approximate: pick.approximate,
            })),
        };
    }

    // Sentimentos por onde a playlist passa entre partida e chegada (mesmo caminho do build).
    path(dto: JourneyPathQueryDto): { path: string[] } {
        const clusters = Object.fromEntries(EMOTION_CLUSTERS.map(label => [label, getClusterVector(label)!]));
        return { path: waypointsAlong(dto.from, dto.to, clusters) };
    }

    // Adiciona à fila do Spotify só as músicas que o usuário manteve, na ordem recebida.
    async queue(userId: string, dto: QueueJourneyDto): Promise<JourneyQueueResponse> {
        const user = await this.repository.getUser(userId);
        if (!user) throw new NotFoundException('Usuário não encontrado');

        const provider = this.providers.getProvider(user.provider);
        if (!provider.addTracksToQueue) {
            throw new BadRequestException('Adicionar à fila está disponível apenas para contas do Spotify.');
        }

        const accessToken = await provider.refreshToken(user.refreshToken!);
        const result = await provider.addTracksToQueue(accessToken, dto.trackIds);
        return { requested: dto.trackIds.length, queued: result.queued, queueError: result.error };
    }

    // Modos all/saved: o usuário escolhe partida e chegada. Modo custom: o Jev
    // lê o pedido e decide o destino; a partida vem do pedido, do humor atual
    // do usuário ou, em último caso, do palpite do Jev.
    private async resolveJourney(userId: string, dto: JourneyPlaylistDto): Promise<ResolvedJourney> {
        if (dto.source !== 'custom') {
            if (!dto.from || !dto.to) throw new BadRequestException('Escolha o sentimento de partida e o de chegada.');
            // Partida = chegada: playlist de um humor só (todas as paradas no mesmo ponto).
            return { from: dto.from, to: dto.to };
        }

        const request = dto.request!.trim();
        const interpretation = await this.aiText.interpretJourneyRequest(request);
        if (!interpretation.isMusic) {
            throw new UnprocessableEntityException(`"${request}" não parece um pedido de música. Tente um artista, gênero, estilo ou como quer se sentir.`);
        }

        // Pedido só de sentimento/atividade ("to com raiva e quero me acalmar"): monta a
        // jornada como no modo "all". Com estilo ("rock pesado", "mpb"): filtra pelo estilo.
        const style = interpretation.hasStyle ? { request, genre: interpretation.genre } : undefined;

        if (interpretation.statedFrom) return { from: interpretation.statedFrom, to: interpretation.to, fromOrigin: 'request', style };

        const currentMood = await this.repository.getCurrentMood(userId);
        if (currentMood && EMOTION_CLUSTERS.includes(currentMood)) {
            return { from: currentMood, to: interpretation.to, fromOrigin: 'current_mood', style };
        }

        return { from: interpretation.guessedFrom, to: interpretation.to, fromOrigin: 'jev_guess', style };
    }

    private async collectCandidates(dto: JourneyPlaylistDto, journey: ResolvedJourney, ctx: {
        from: Vector;
        to: Vector;
        pool: JourneyCandidate[];
        taste: UserTaste;
        provider: MusicProviderInterface;
        accessToken: string;
        recentIds: Set<string>;
    }): Promise<{ candidates: JourneyCandidate[]; newTracksAnalyzed: number }> {
        switch (dto.source) {
            // Só as curtidas já analisadas; nada de busca externa.
            case 'saved':
                return { candidates: ctx.pool.filter(c => ctx.taste.savedIds.has(c.spotifyId)), newTracksAnalyzed: 0 };

            // Só busca no Spotify (requestSource "search"). O acervo serve apenas para
            // reaproveitar análises; músicas do usuário não ganham preferência aqui.
            case 'custom': {
                const found = journey.style
                    ? (await this.sourcing.fromRequest(journey.style.request, ctx, ctx.pool, journey.style.genre)).candidates
                    : await this.sourcing.searchForJourney(buildPath(ctx.from, ctx.to, stopCountForDuration(dto.durationMin)), ctx, ctx.pool);

                const knownIds = new Set(ctx.pool.map(p => p.spotifyId));
                return {
                    candidates: found.map(c => ({ ...c, fromUserHistory: false })),
                    newTracksAnalyzed: found.filter(c => !knownIds.has(c.spotifyId)).length,
                };
            }

            // Acervo inteiro + busca automática onde faltar música. Músicas sugeridas
            // há pouco não contam como cobertura: a parada busca novidade no Spotify.
            default: {
                const stops = stopCountForDuration(dto.durationMin);
                const path = buildPath(ctx.from, ctx.to, stops);
                const unseen = ctx.pool.filter(c => !ctx.recentIds.has(c.spotifyId));
                const sourcing = {
                    provider: ctx.provider,
                    accessToken: ctx.accessToken,
                    knownIds: new Set(ctx.pool.map(c => c.spotifyId)),
                    topArtists: ctx.taste.topArtists,
                    topSubgenres: ctx.taste.topSubgenres,
                };

                // Um humor só: uma música perto não basta, precisa de uma por parada.
                if (journey.from === journey.to) {
                    const near = unseen.filter(c => distance(ctx.from, c.vector) <= NEAR_RADIUS).length;
                    const fresh = near < stops ? await this.sourcing.fillPoint(ctx.from, stops - near, sourcing) : [];
                    return { candidates: [...ctx.pool, ...fresh], newTracksAnalyzed: fresh.length };
                }

                const gapStops = findGaps(path, unseen).map(index => path[index]);
                const fresh = gapStops.length ? await this.sourcing.fillGaps(gapStops, sourcing) : [];
                return { candidates: [...ctx.pool, ...fresh], newTracksAnalyzed: fresh.length };
            }
        }
    }

    private emptyMessage(dto: JourneyPlaylistDto): string {
        if (dto.source === 'saved') {
            return 'Ainda não há músicas curtidas analisadas. Elas são importadas logo após o login — tente de novo em alguns minutos.';
        }
        if (dto.source === 'custom') {
            return `Não encontrei músicas de "${dto.request}" que o Jev confirmasse. Tente escrever de outro jeito.`;
        }
        return 'Não encontrei músicas para montar essa jornada. Ouça mais algumas músicas e tente de novo.';
    }
}
