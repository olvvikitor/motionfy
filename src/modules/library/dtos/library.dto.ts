import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches, ValidateNested } from 'class-validator';

// "liked" = Músicas Curtidas (no Last.fm, as amadas); "top-<período>" = mais ouvidas no Last.fm;
// qualquer outro valor é o ID de uma playlist do Spotify.
export const LIKED_SOURCE = 'liked';
const SOURCE_PATTERN = /^(liked|top-(7day|1month|12month|overall)|[A-Za-z0-9]{22})$/;
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

export class LibrarySourceParamDto {
    @Matches(SOURCE_PATTERN, { message: 'Origem inválida.' })
    source!: string;
}

export class LibraryTrackParamDto {
    @Matches(SPOTIFY_ID_PATTERN, { message: 'ID de música do Spotify inválido.' })
    spotifyId!: string;
}

export class LibrarySelectionDto {
    @IsString()
    @Matches(SOURCE_PATTERN, { message: 'Origem inválida.' })
    source!: string;

    @IsArray()
    @ArrayMinSize(1, { message: 'Escolha pelo menos uma música.' })
    @ArrayMaxSize(500, { message: 'No máximo 500 músicas por origem.' })
    @Matches(SPOTIFY_ID_PATTERN, { each: true, message: 'ID de música do Spotify inválido.' })
    spotifyIds!: string[];
}

// O usuário escolheu músicas em uma ou mais origens; o servidor busca os dados de cada uma no Spotify.
export class AddToLibraryDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'Escolha pelo menos uma música.' })
    @ArrayMaxSize(50, { message: 'Origens demais de uma vez.' })
    @ValidateNested({ each: true })
    @Type(() => LibrarySelectionDto)
    items!: LibrarySelectionDto[];
}
