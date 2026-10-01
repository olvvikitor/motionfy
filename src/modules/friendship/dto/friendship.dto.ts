import { Type } from "class-transformer";
import { IsBoolean, IsDate, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class SendFriendRequestDto {
    @IsString()
    @IsNotEmpty()
    addresseeId: string;
}

export class RespondFriendRequestDto {
    @IsString()
    @IsNotEmpty()
    friendshipId: string;
    @IsBoolean()
    accept: boolean;
}

// Feed em páginas: ?before= (hora do último item da página anterior) e ?limit=.
export class FeedQueryDto {
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: 'Cursor inválido.' })
    before?: Date;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(30)
    limit?: number;
}

// Humor ou playlist do feed que recebe reação/comentário.
export class FeedTargetParamDto {
    @IsIn(['mood', 'playlist'], { message: 'Tipo inválido.' })
    kind!: 'mood' | 'playlist';

    @IsUUID('4', { message: 'Item inválido.' })
    id!: string;
}

export class FeedReactionDto {
    @IsString()
    @IsNotEmpty()
    emoji!: string;
}

export class FeedCommentDto {
    @IsString()
    @IsNotEmpty({ message: 'Escreva o comentário.' })
    @MaxLength(280, { message: 'O comentário pode ter até 280 letras.' })
    text!: string;
}

// Playlist de alguém (você ou um amigo): dono + id do Mofy.
export class PlaylistOwnerParamDto {
    @IsString()
    @IsNotEmpty()
    ownerId!: string;

    @IsUUID('4', { message: 'Playlist inválida.' })
    id!: string;
}
