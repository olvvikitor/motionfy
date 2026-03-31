import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

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
