import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { JourneyPlaylistDto } from '../dtos/journey-playlist.dto';
import { JourneyPlaylistService } from '../services/journey-playlist.service';

@Controller('user')
export class PlaylistController {
    constructor(private readonly journeyPlaylist: JourneyPlaylistService) { }

    @Post('journey-playlist')
    @UseGuards(JwtAuthGuard)
    async createJourneyPlaylist(@Req() req: MRequest, @Body() dto: JourneyPlaylistDto) {
        return await this.journeyPlaylist.build(req.user!.id, dto);
    }
}
