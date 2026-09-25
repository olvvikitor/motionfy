import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

const REQUEST_MESSAGE = 'Diga o que você quer ouvir (de 2 a 200 caracteres).';
import { EMOTION_CLUSTERS } from 'src/shared/infra/IA/emotion-analysis.service';

export const JOURNEY_SOURCES = ['all', 'saved', 'custom'] as const;
export type JourneySource = typeof JOURNEY_SOURCES[number];

export const REQUEST_SOURCES = ['search'] as const;
export type RequestSource = typeof REQUEST_SOURCES[number];

export class JourneyPlaylistDto {
    // No modo custom o Jev decide partida e chegada a partir do pedido.
    @ValidateIf((dto: JourneyPlaylistDto) => dto.source !== 'custom')
    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de partida inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    from?: string;

    @ValidateIf((dto: JourneyPlaylistDto) => dto.source !== 'custom')
    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de chegada inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    to?: string;

    @IsInt({ message: 'A duração deve ser um número inteiro de minutos.' })
    @Min(10, { message: 'A duração mínima é 10 minutos.' })
    @Max(90, { message: 'A duração máxima é 90 minutos.' })
    durationMin!: number;

    // all = acervo + busca automática; saved = só a biblioteca do usuário (SavedTrack); custom = o que o usuário pedir em `request`.
    @IsOptional()
    @IsIn(JOURNEY_SOURCES, { message: 'Origem inválida. Use all, saved ou custom.' })
    source: JourneySource = 'all';

    @ValidateIf((dto: JourneyPlaylistDto) => dto.source === 'custom')
    @IsString({ message: REQUEST_MESSAGE })
    @Length(2, 200, { message: REQUEST_MESSAGE })
    request?: string;

    // De onde vêm as músicas no modo custom. Por enquanto só "search" (busca no Spotify).
    @IsOptional()
    @IsIn(REQUEST_SOURCES, { message: 'Origem do pedido inválida. Use search.' })
    requestSource: RequestSource = 'search';
}

const TRACK_IDS_MESSAGE = 'Escolha de 1 a 60 músicas para adicionar à fila.';

// Segundo passo: o usuário revisou a sugestão e manda só as músicas que quer, na ordem.
export class QueueJourneyDto {
    @IsArray({ message: TRACK_IDS_MESSAGE })
    @ArrayMinSize(1, { message: TRACK_IDS_MESSAGE })
    @ArrayMaxSize(60, { message: TRACK_IDS_MESSAGE })
    @Matches(/^[A-Za-z0-9]{22}$/, { each: true, message: 'ID de música do Spotify inválido.' })
    trackIds!: string[];
}

// Cria a playlist na conta do Mofy no Spotify com as músicas mantidas, na ordem.
export class SpotifyPlaylistDto extends QueueJourneyDto {
    // Ex.: "Ansioso → Calmo". O servidor põe "Mofy · " na frente.
    @IsString({ message: 'Nome da playlist inválido.' })
    @Length(1, 80, { message: 'O nome da playlist pode ter até 80 caracteres.' })
    title!: string;

    // Humor da playlist (chegada) e partida: organizam o destaque do perfil.
    @IsOptional()
    @IsIn(EMOTION_CLUSTERS, { message: 'Humor da playlist inválido.' })
    sentiment?: string;

    @IsOptional()
    @IsIn(EMOTION_CLUSTERS, { message: 'Humor de partida inválido.' })
    fromSentiment?: string;
}

const FEATURED_MESSAGE = 'Escolha até 5 playlists para o destaque.';

// Playlists que aparecem no destaque do perfil, na ordem.
export class FeaturedPlaylistsDto {
    @IsArray({ message: FEATURED_MESSAGE })
    @ArrayMaxSize(5, { message: FEATURED_MESSAGE })
    @Matches(/^[A-Za-z0-9]{22}$/, { each: true, message: 'ID de playlist do Spotify inválido.' })
    playlistIds!: string[];
}

// Playlist da conta do Mofy (id do Spotify) na rota da capa.
export class PlaylistIdParamDto {
    @Matches(/^[A-Za-z0-9]{22}$/, { message: 'ID de playlist do Spotify inválido.' })
    playlistId!: string;
}

// Capa gerada pela IA a partir do humor da playlist.
export class GenerateCoverDto {
    @IsIn(EMOTION_CLUSTERS, { message: `Humor inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    sentiment!: string;
}

// Trajeto de sentimentos entre partida e chegada (só para desenhar na UI).
export class JourneyPathQueryDto {
    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de partida inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    from!: string;

    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de chegada inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    to!: string;
}
