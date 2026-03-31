import { IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

class NotificationPreferencesDto {
    @IsBoolean()
    push!: boolean;

    @IsBoolean()
    email!: boolean;

    @IsBoolean()
    weekly!: boolean;
}

export class UpdateAfterCreateDto {
    @ValidateNested()
    @Type(() => NotificationPreferencesDto)
    data!: NotificationPreferencesDto;
}
