import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { JourneyPlaylistDto } from "../dtos/journey-playlist.dto";
import { PlaylistRepository } from "../repository/playlist.repository";
import { CandidateSourcingService } from "./candidate-sourcing.service";
import { buildJourney, buildPath, findGaps, stopCountForDuration, totalDurationMs, trackDuration } from "./journey-path";

export type JourneyPlaylistResponse = {
    from: string;
    to: string;
    durationMin: number;
    totalDurationMs: number;
    newTracksAnalyzed: number;
    queued: number;
    queueError?: string;
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

@Injectable()
export class JourneyPlaylistService {
    constructor(
        private readonly repository: PlaylistRepository,
        private readonly sourcing: CandidateSourcingService,
        private readonly providers: MusicProviderFactory,
    ) { }

    async build(userId: string, dto: JourneyPlaylistDto): Promise<JourneyPlaylistResponse> {
        if (dto.from === dto.to) throw new BadRequestException('Escolha sentimentos de partida e chegada diferentes.');

        const user = await this.repository.getUser(userId);
        if (!user) throw new NotFoundException('Usuário não encontrado');

        const provider = this.providers.getProvider(user.provider);
        if (!provider.searchTracks || !provider.addTracksToQueue) {
            throw new BadRequestException('Playlist de jornada disponível apenas para contas do Spotify.');
        }

        const from = getClusterVector(dto.from)!;
        const to = getClusterVector(dto.to)!;
        const accessToken = await provider.refreshToken(user.refreshToken!);

        const taste = await this.repository.getUserTaste(userId);
        const pool = await this.repository.getAnalyzedPool(taste.historyIds);

        const path = buildPath(from, to, stopCountForDuration(dto.durationMin));
        const gapStops = findGaps(path, pool).map(index => path[index]);

        const fresh = gapStops.length
            ? await this.sourcing.fillGaps(gapStops, {
                provider,
                accessToken,
                knownIds: new Set(pool.map(c => c.spotifyId)),
                topArtists: taste.topArtists,
                topSubgenres: taste.topSubgenres,
            })
            : [];

        const picks = buildJourney(from, to, dto.durationMin, [...pool, ...fresh]);
        if (!picks.length) {
            throw new UnprocessableEntityException('Não encontrei músicas para montar essa jornada. Ouça mais algumas músicas e tente de novo.');
        }

        const queue = await provider.addTracksToQueue(accessToken, picks.map(p => p.candidate.spotifyId));
        const lastStop = Math.max(1, picks[picks.length - 1].stop);

        return {
            from: dto.from,
            to: dto.to,
            durationMin: dto.durationMin,
            totalDurationMs: totalDurationMs(picks),
            newTracksAnalyzed: fresh.length,
            queued: queue.queued,
            queueError: queue.error,
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
}
