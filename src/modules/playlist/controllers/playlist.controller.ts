import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { JourneyPathQueryDto, JourneyPlaylistDto, QueueJourneyDto } from '../dtos/journey-playlist.dto';
import { JourneyPlaylistService } from '../services/journey-playlist.service';

@Controller('user')
export class PlaylistController {
    constructor(private readonly journeyPlaylist: JourneyPlaylistService) { }

    @Post('journey-playlist')
    @UseGuards(JwtAuthGuard)
    async createJourneyPlaylist(@Req() req: MRequest, @Body() dto: JourneyPlaylistDto) {
        return await this.journeyPlaylist.build(req.user!.id, dto);
    }

    // Trajeto de sentimentos entre partida e chegada, para desenhar na tela.
    @Get('journey-playlist/path')
    @UseGuards(JwtAuthGuard)
    journeyPath(@Query() query: JourneyPathQueryDto) {
        return this.journeyPlaylist.path(query);
    }

    // Depois da revisão: só as músicas escolhidas vão para a fila.
    @Post('journey-playlist/queue')
    @UseGuards(JwtAuthGuard)
    async queueJourneyPlaylist(@Req() req: MRequest, @Body() dto: QueueJourneyDto) {
        return await this.journeyPlaylist.queue(req.user!.id, dto);
    }
}
