import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

const REQUEST_MESSAGE = 'Diga o que você quer ouvir (de 2 a 200 caracteres).';
import { EMOTION_CLUSTERS } from 'src/shared/infra/IA/emotion-analysis.service';
import { BPM_RANGE_KEYS, NATIONAL_OPTIONS, type BpmRange, type NationalOption } from '../services/journey-filters';
import { PLAYLIST_DURATIONS } from '../services/playlist-pricing';

export const JOURNEY_SOURCES = ['all', 'saved', 'custom'] as const;
export type JourneySource = typeof JOURNEY_SOURCES[number];

export const REQUEST_SOURCES = ['search'] as const;
export type RequestSource = typeof REQUEST_SOURCES[number];

// Jornada (all/saved): partida e chegada. Um humor: só `mood`. Pedido (custom): o Jev decide.
const needsJourney = (dto: JourneyPlaylistDto) => dto.source !== 'custom' && !dto.mood;

export class JourneyPlaylistDto {
    @ValidateIf(needsJourney)
    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de partida inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    from?: string;

    @ValidateIf(needsJourney)
    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de chegada inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    to?: string;

    // Playlist de um humor só (com os humores próximos dele), no lugar de partida → chegada. Modos all/saved.
    @IsOptional()
    @IsIn(EMOTION_CLUSTERS, { message: `Humor inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    mood?: string;

    // Acima de 45 min a geração custa créditos (playlist-pricing.ts).
    @IsIn(PLAYLIST_DURATIONS, { message: `Duração inválida. Use uma de: ${PLAYLIST_DURATIONS.join(', ')} minutos.` })
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

    // Filtros (modos all/saved), cada um com várias opções. Gênero e subgênero somam; BPM restringe.
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20, { message: 'Escolha até 20 gêneros.' })
    @IsString({ each: true })
    @Length(1, 60, { each: true })
    genres?: string[];

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20, { message: 'Escolha até 20 subgêneros.' })
    @IsString({ each: true })
    @Length(1, 60, { each: true })
    subgenres?: string[];

    @IsOptional()
    @IsArray()
    @IsIn(BPM_RANGE_KEYS, { each: true, message: `Faixa de BPM inválida. Use: ${BPM_RANGE_KEYS.join(', ')}.` })
    bpm?: BpmRange[];

    // Música nacional (artista brasileiro): include (padrão), exclude = sem, only = só nacional.
    @IsOptional()
    @IsIn(NATIONAL_OPTIONS, { message: `Opção de música nacional inválida. Use: ${NATIONAL_OPTIONS.join(', ')}.` })
    national?: NationalOption;
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

// Página das playlists do perfil: cursor = id da última da página anterior.
export class ShowcaseQueryDto {
    @IsOptional()
    @IsUUID('4', { message: 'Cursor inválido.' })
    cursor?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    limit?: number;
}

// Playlist da conta do Mofy (id do Spotify) na rota da capa.
export class PlaylistIdParamDto {
    @Matches(/^[A-Za-z0-9]{22}$/, { message: 'ID de playlist do Spotify inválido.' })
    playlistId!: string;
}

// Playlist pelo id do Mofy (a biblioteca guarda também as que já saíram do Spotify).
export class MofyPlaylistIdParamDto {
    @IsUUID('4', { message: 'Playlist inválida.' })
    id!: string;
}

// Base da capa gerada: a foto do rosto do perfil, uma foto enviada agora (tirada ou da galeria,
// no campo "file") ou nenhuma (só humor e músicas).
export const COVER_REFERENCES = ['profile', 'photo', 'none'] as const;
export type CoverReferenceSource = typeof COVER_REFERENCES[number];

// Capa gerada pela IA a partir do humor da playlist (multipart: a foto, se houver, vai em "file").
export class GenerateCoverDto {
    @IsIn(EMOTION_CLUSTERS, { message: `Humor inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    sentiment!: string;

    @IsOptional()
    @IsIn(COVER_REFERENCES, { message: 'Referência inválida.' })
    reference?: CoverReferenceSource;
}

// Capa de outra playlist do usuário (id do Mofy), reaproveitada na playlist nova.
export class ReuseCoverDto {
    @IsUUID('4', { message: 'Capa inválida.' })
    fromId!: string;
}

// Trajeto de sentimentos entre partida e chegada (só para desenhar na UI).
export class JourneyPathQueryDto {
    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de partida inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    from!: string;

    @IsIn(EMOTION_CLUSTERS, { message: `Sentimento de chegada inválido. Use um de: ${EMOTION_CLUSTERS.join(', ')}.` })
    to!: string;
}
