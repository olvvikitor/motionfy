import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { AiTextService } from "src/shared/infra/IA/AiText.service";
import { EMOTION_CLUSTERS } from "src/shared/infra/IA/emotion-analysis.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { MusicProviderInterface } from "src/shared/infra/music/music.provider.interface";
import { JourneyPathQueryDto, JourneyPlaylistDto, JourneySource, QueueJourneyDto } from "../dtos/journey-playlist.dto";
import { PlaylistRepository, UserTaste } from "../repository/playlist.repository";
import { TrackInput } from "src/shared/types/TrackInput";
import { ArtistCountryService } from "./artist-country.service";
import { CandidateSourcingService } from "./candidate-sourcing.service";
import { CreditService } from "src/modules/credits/credit.service";
import { durationCost } from "./playlist-pricing";
import { buildFacets, chosenGenres, FilterFacets, hasFilters, isNationalGenre, JourneyFilters, matchesFilters } from "./journey-filters";
import { buildJourney, buildPath, capPerArtist, distance, findGaps, FIT_RADIUS, isNovel, nearestMood, primaryArtist, suggestionFatigue, waypointsAlong, moodAreas, JourneyCandidate, shuffle, stopCountForDuration, totalDurationMs, trackDuration, Vector } from "./journey-path";
import { MoodCentroidsService } from "./mood-centroids.service";

export type JourneyPlaylistResponse = {
    // Um humor: partida = chegada = o humor escolhido (capa e cor).
    from: string;
    to: string;
    // Um humor: os humores que podiam entrar (o escolhido primeiro, depois os próximos).
    moods?: string[];
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

// Janela do cansaço: sugestões mais velhas que isso já não pesam (e são apagadas).
const RECENT_SUGGESTION_DAYS = 30;
// No "Descobrir", ~60% da playlist vem de músicas novas para o usuário (populares do gênero).
const NOVELTY_SHARE = 0.6;
// Sem gênero nos filtros, as músicas de fora ficam nos gêneros principais do usuário.
const TOP_GENRES = 3;
const TOP_SUBGENRES = 4;
// Abaixo disso a música já "descansou" e conta como cobertura da parada.
const RESTED_FATIGUE = 0.1;

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
    // Playlist de um humor: from = to = ele; entram músicas dele e dos humores próximos (moodAreas).
    moods?: string[];
};

// Gêneros de onde vêm as músicas de fora no "Descobrir" (tags das populares) e o teste de cada música.
type GenreScope = { genres: string[]; inScope: (candidate: JourneyCandidate) => boolean };

@Injectable()
export class JourneyPlaylistService {
    constructor(
        private readonly repository: PlaylistRepository,
        private readonly sourcing: CandidateSourcingService,
        private readonly providers: MusicProviderFactory,
        private readonly aiText: AiTextService,
        private readonly credits: CreditService,
        private readonly artistCountry: ArtistCountryService,
        private readonly centroids: MoodCentroidsService,
    ) { }

    // Só sugere as músicas. Nada vai para a fila até o usuário revisar e chamar queue().
    // Acima de 45 min a geração custa créditos (playlist-pricing.ts): debita antes (sem saldo, nem começa) e
    // devolve se a geração falhar.
    async build(userId: string, dto: JourneyPlaylistDto): Promise<JourneyPlaylistResponse> {
        const cost = durationCost(dto.durationMin);
        if (!cost) return this.compose(userId, dto);

        const price = cost.toFixed(2).replace('.', ',');
        await this.credits.consumeCredit(userId, `Playlist de ${dto.durationMin} min`, cost,
            `Playlists de ${dto.durationMin} min custam ${price} crédito. Compre créditos para gerar.`);
        try {
            return await this.compose(userId, dto);
        } catch (error) {
            await this.credits.refundCredit(userId, `Estorno: playlist de ${dto.durationMin} min não gerada`, cost)
                .catch(refundError => console.error('[JourneyPlaylist] estorno falhou:', refundError?.message ?? refundError));
            throw error;
        }
    }

    private async compose(userId: string, dto: JourneyPlaylistDto): Promise<JourneyPlaylistResponse> {
        const clusters = await this.centroids.clusters();
        const journey = await this.resolveJourney(userId, dto, clusters);

        const user = await this.repository.getUser(userId);
        if (!user) throw new NotFoundException('Usuário não encontrado');

        const provider = this.providers.getProvider(user.provider);
        // Last.fm também sugere (busca no catálogo do Spotify); só a fila exige login do Spotify.
        if (!provider.searchTracks) {
            throw new BadRequestException('Playlist de jornada disponível apenas para contas do Spotify ou Last.fm.');
        }

        const from = clusters[journey.from];
        const to = clusters[journey.to];
        // Humor de cada parada: o escolhido (um humor) ou o do centro mais perto do ponto do caminho.
        const moodOf = journey.moods ? () => journey.from : (point: Vector) => nearestMood(point, clusters);
        const accessToken = await provider.refreshToken(user.refreshToken!);

        const taste = await this.repository.getUserTaste(userId);
        const fullPool = await this.repository.getAnalyzedPool(taste.tasteIds);
        const since = new Date(Date.now() - RECENT_SUGGESTION_DAYS * 86_400_000);
        const fatigue = suggestionFatigue(await this.repository.getSuggestionHistory(userId, since), new Date());

        // Filtros do usuário (gêneros, subgêneros, BPM): valem para o acervo e para as músicas novas buscadas.
        // O pedido em texto (custom) tem o estilo dele e não usa filtros.
        const filters: JourneyFilters = dto.source === 'custom' ? {} : { genres: dto.genres, subgenres: dto.subgenres, bpm: dto.bpm, national: dto.national };
        const filtering = hasFilters(filters);
        // País do artista (música nacional): só quando o filtro pede.
        if (filters.national && filters.national !== 'include') await this.artistCountry.annotate(fullPool);
        const pool = filtering ? fullPool.filter(c => matchesFilters(c, filters)) : fullPool;

        const moods = journey.moods;
        const collected = await this.collectCandidates(dto, journey, { from, to, moodOf, clusters, pool, fullPool, taste, provider, accessToken, fatigue, filters });
        // Um humor: só músicas dele ou de um humor próximo (nada de "aproximada" de humor longe).
        const candidates = collected.candidates.filter(c =>
            (!filtering || matchesFilters(c, filters)) && (!moods || moods.includes(c.dominantSentiment)));
        const { newTracksAnalyzed } = collected;

        // Sorteio com peso entre as que combinam com cada parada, as do humor da parada primeiro (rótulo do Jev)
        // e sem troca brusca de gênero/andamento; as sugeridas muitas vezes/há pouco perdem posição e, no
        // "Descobrir", ~60% vem de músicas novas para o usuário.
        // "Descobrir": músicas de outros usuários/novidades só se se encaixarem no humor da parada.
        // "Minha biblioteca" já só tem as do usuário; o pedido em texto só busca no Spotify.
        // Um humor: todas as paradas no humor escolhido e qualquer música dele ou de um próximo serve, mas as
        // de um próximo só entram quando acabam as dele.
        const options = {
            sample: true,
            moodOf,
            fatigue,
            othersMustFit: dto.source === 'all',
            noveltyShare: dto.source === 'all' ? NOVELTY_SHARE : 0,
            ...(moods ? { fits: (c: JourneyCandidate) => moods.includes(c.dominantSentiment) } : {}),
        };
        const picks = buildJourney(from, to, dto.durationMin, candidates, options);
        if (!picks.length) throw new UnprocessableEntityException(this.emptyMessage(dto, filtering));

        await this.repository.saveSuggestions(userId, picks.map(p => p.candidate.spotifyId), since);

        const lastStop = Math.max(1, picks[picks.length - 1].stop);

        return {
            from: journey.from,
            to: journey.to,
            moods,
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

    // Opções dos filtros: gêneros, subgêneros e faixas de BPM das músicas do usuário, com quantas tem de cada.
    async filterOptions(userId: string): Promise<FilterFacets> {
        const taste = await this.repository.getUserTaste(userId);
        return buildFacets(await this.repository.getTasteFacetRows(taste.tasteIds));
    }

    // Sentimentos por onde a playlist passa entre partida e chegada (mesmo caminho do build).
    async path(dto: JourneyPathQueryDto): Promise<{ path: string[] }> {
        return { path: waypointsAlong(dto.from, dto.to, await this.centroids.clusters()) };
    }

    // Humores que podem vir junto com cada um (área no mapa do seletor).
    async areas(): Promise<{ areas: Record<string, string[]> }> {
        return { areas: moodAreas(await this.centroids.clusters()) };
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
    private async resolveJourney(userId: string, dto: JourneyPlaylistDto, clusters: Record<string, Vector>): Promise<ResolvedJourney> {
        if (dto.source !== 'custom') {
            if (dto.mood) {
                return { from: dto.mood, to: dto.mood, moods: [dto.mood, ...(moodAreas(clusters)[dto.mood] ?? [])] };
            }
            if (!dto.from || !dto.to) throw new BadRequestException('Escolha o sentimento de partida e o de chegada.');
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
        moodOf: (point: Vector) => string;
        clusters: Record<string, Vector>;
        pool: JourneyCandidate[]; // acervo já com os filtros
        fullPool: JourneyCandidate[];
        taste: UserTaste;
        provider: MusicProviderInterface;
        accessToken: string;
        fatigue: Map<string, number>;
        filters: JourneyFilters;
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
                    : await this.sourcing.searchForJourney(buildPath(ctx.from, ctx.to, stopCountForDuration(dto.durationMin)), ctx, ctx.pool, ctx.clusters);

                const knownIds = new Set(ctx.pool.map(p => p.spotifyId));
                return {
                    candidates: found.map(c => ({ ...c, fromUserHistory: false })),
                    newTracksAnalyzed: found.filter(c => !knownIds.has(c.spotifyId)).length,
                };
            }

            // As do usuário + músicas de fora de artistas que ele já ouve + as **populares do gênero** (paradas
            // do Last.fm dos gêneros escolhidos ou, sem filtro, dos principais dele, e os sucessos dos artistas
            // dele). De fora, só dentro do gênero. As populares já analisadas entram sempre; as novas passam
            // pelo Jev só onde faltar música "descansada" ou novidade para fechar a cota.
            default: {
                const stops = stopCountForDuration(dto.durationMin);
                const quota = Math.ceil(NOVELTY_SHARE * stops);
                const scope = await this.genreScope(ctx.taste, ctx.filters);
                const knownArtists = new Set(ctx.taste.topArtists.map(primaryArtist));
                const base = ctx.pool.filter(c => c.fromUserHistory || (knownArtists.has(primaryArtist(c.artist)) && scope.inScope(c)));
                const rested = base.filter(c => (ctx.fatigue.get(c.spotifyId) ?? 0) < RESTED_FATIGUE);
                const novel = base.filter(c => isNovel(c, ctx.fatigue));

                let fits: (c: JourneyCandidate) => boolean;
                let needed: number;
                const moods = journey.moods;
                // Cobertura contada com o limite por artista: 8 músicas do mesmo artista valem 2 na playlist.
                if (moods) {
                    // Um humor: falta uma do próprio humor por parada (e a cota de novas). As dos próximos só
                    // completam, então não contam como cobertura nem guiam a busca de novas.
                    fits = c => c.dominantSentiment === journey.from;
                    const count = (list: JourneyCandidate[]) => capPerArtist(list.filter(fits)).length;
                    needed = Math.max(0, stops - count(rested), quota - count(novel));
                } else {
                    // Jornada: paradas sem música que sirva, mais as que faltam para a cota de novas
                    // (espalhadas pelo caminho primeiro).
                    const path = buildPath(ctx.from, ctx.to, stops);
                    const moodsOnPath = new Set(path.map(ctx.moodOf));
                    fits = c => moodsOnPath.has(c.dominantSentiment) || path.some(p => distance(p, c.vector) <= FIT_RADIUS);
                    const gaps = new Set(findGaps(path, capPerArtist(rested), ctx.moodOf));
                    const novelGaps = findGaps(path, capPerArtist(novel), ctx.moodOf);
                    const deficit = quota - (stops - novelGaps.length);
                    if (deficit > 0) {
                        const spread = new Set(Array.from({ length: quota }, (_, i) => Math.floor((i * stops) / quota)));
                        const ordered = [...novelGaps.filter(i => spread.has(i)), ...novelGaps.filter(i => !spread.has(i))];
                        ordered.slice(0, deficit).forEach(i => gaps.add(i));
                    }
                    needed = gaps.size;
                }

                // Artistas do usuário com música dele que sirva primeiro (os sucessos deles tendem a servir também).
                const fittingArtists = new Set(base.filter(c => c.fromUserHistory && fits(c)).map(c => primaryArtist(c.artist)));
                const artists = [
                    ...shuffle(ctx.taste.topArtists.filter(a => fittingArtists.has(primaryArtist(a)))),
                    ...ctx.taste.topArtists.filter(a => !fittingArtists.has(primaryArtist(a))),
                ];

                const national = ctx.filters.national && ctx.filters.national !== 'include' ? ctx.filters.national : null;
                const popular = await this.sourcing.popular({
                    genres: scope.genres,
                    artists,
                    analyzed: new Map(ctx.fullPool.map(c => [c.spotifyId, c])),
                    tasteIds: ctx.taste.tasteIds,
                    fits,
                    // Gênero e os outros filtros (BPM, música nacional): não gasta o Jev com o que sairia depois.
                    inScope: c => scope.inScope(c) && matchesFilters(c, ctx.filters),
                    // Filtro de música nacional: o país do artista antes do teste acima e, nas novas, só as de artista
                    // com país conhecido e do lado certo passam pelo Jev.
                    ...(national ? {
                        annotate: (list: JourneyCandidate[]) => this.artistCountry.annotate(list),
                        eligible: (tracks: TrackInput[]) => this.artistCountry.keepMatching(tracks, national),
                    } : {}),
                    needed,
                });
                const candidates = [...new Map([...base, ...popular.candidates].map(c => [c.spotifyId, c])).values()];
                return { candidates, newTracksAnalyzed: popular.classified };
            }
        }
    }

    // Gêneros das músicas de fora: os escolhidos nos filtros ou, sem filtro de gênero, os principais do
    // usuário (e os subgêneros mais ouvidos deles, que dão paradas de populares mais certeiras).
    private async genreScope(taste: UserTaste, filters: JourneyFilters): Promise<GenreScope> {
        const chosen = chosenGenres(filters);
        if (chosen.length) {
            const genreFilters = { genres: filters.genres, subgenres: filters.subgenres };
            return { genres: chosen, inScope: c => matchesFilters(c, genreFilters) };
        }

        const facets = buildFacets(await this.repository.getTasteFacetRows(taste.tasteIds));

        // Só nacional: o artista brasileiro faz pop, rock, eletrônica… então o gênero não restringe (o filtro
        // já restringe bastante); as populares vêm dos gêneros brasileiros que a pessoa ouve ou da tag geral.
        if (filters.national === 'only') {
            const national = [...facets.subgenres, ...facets.genres].map(g => g.name).filter(isNationalGenre);
            return { genres: national.length ? [...new Set(national)].slice(0, TOP_SUBGENRES) : ['brazilian'], inScope: () => true };
        }

        // Sem música nacional: os gêneros brasileiros não contam entre os principais (nem viram busca de populares).
        const allowed = (name: string) => filters.national !== 'exclude' || !isNationalGenre(name);
        const top = facets.genres.filter(g => allowed(g.name)).slice(0, TOP_GENRES).map(g => g.name);
        if (!top.length) return { genres: [], inScope: () => true }; // sem gênero conhecido ainda: não restringe
        const subgenres = facets.subgenres.filter(s => top.includes(s.genre) && allowed(s.name)).slice(0, TOP_SUBGENRES).map(s => s.name);
        return {
            genres: subgenres.length ? subgenres : top,
            inScope: c => Boolean(c.genre && top.includes(c.genre)),
        };
    }

    private emptyMessage(dto: JourneyPlaylistDto, filtering: boolean): string {
        if (dto.national && dto.national !== 'include') {
            return 'Nenhuma música combina com esse filtro de música nacional agora. Ainda estamos descobrindo o país de alguns artistas: tente de novo em alguns minutos ou mude o filtro.';
        }
        if (dto.mood) {
            return filtering
                ? 'Nenhuma música desse humor combina com esses filtros. Tire algum filtro e tente de novo.'
                : 'Ainda não há músicas desse humor para você. Tente "Descobrir" ou outro humor.';
        }
        if (filtering) return 'Nenhuma música combina com esses filtros e com esse humor. Tire algum filtro e tente de novo.';
        if (dto.source === 'saved') {
            return 'Ainda não há músicas curtidas analisadas. Elas são importadas logo após o login — tente de novo em alguns minutos.';
        }
        if (dto.source === 'custom') {
            return `Não encontrei músicas de "${dto.request}" que o Jev confirmasse. Tente escrever de outro jeito.`;
        }
        return 'Não encontrei músicas para montar essa jornada. Ouça mais algumas músicas e tente de novo.';
    }
}
