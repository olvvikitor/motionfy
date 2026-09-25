import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadFile } from 'src/shared/infra/storage/interfaces/file-storage.interface';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { FeaturedPlaylistsDto, GenerateCoverDto, JourneyPathQueryDto, JourneyPlaylistDto, PlaylistIdParamDto, QueueJourneyDto, SpotifyPlaylistDto } from '../dtos/journey-playlist.dto';
import { JourneyPlaylistService } from '../services/journey-playlist.service';
import { MofyPlaylistService } from '../services/mofy-playlist.service';
import { PlaylistCoverService } from '../services/playlist-cover.service';

@Controller('user')
export class PlaylistController {
    constructor(
        private readonly journeyPlaylist: JourneyPlaylistService,
        private readonly mofyPlaylist: MofyPlaylistService,
        private readonly cover: PlaylistCoverService,
    ) { }

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

    // Depois da revisão: playlist pronta na conta do Mofy no Spotify; devolve o link.
    @Post('journey-playlist/spotify-playlist')
    @UseGuards(JwtAuthGuard)
    async createSpotifyPlaylist(@Req() req: MRequest, @Body() dto: SpotifyPlaylistDto) {
        return await this.mofyPlaylist.create(req.user!.id, dto);
    }

    // Destaque do perfil: todas as playlists criadas (com os dados do card) e as até 5 em destaque.
    @Get('mofy-playlists')
    @UseGuards(JwtAuthGuard)
    async listMofyPlaylists(@Req() req: MRequest) {
        return await this.mofyPlaylist.showcase(req.user!.id);
    }

    @Put('mofy-playlists/featured')
    @UseGuards(JwtAuthGuard)
    async setFeaturedPlaylists(@Req() req: MRequest, @Body() dto: FeaturedPlaylistsDto) {
        return await this.mofyPlaylist.setFeatured(req.user!.id, dto.playlistIds);
    }

    // Capa da playlist criada: imagem do usuário (multipart "file")...
    @Post('journey-playlist/spotify-playlist/:playlistId/cover')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new BadRequestException('Apenas imagens JPEG, PNG ou WEBP.'), false);
            cb(null, true);
        },
    }))
    async uploadCover(@Req() req: MRequest, @Param() params: PlaylistIdParamDto, @UploadedFile() file: UploadFile) {
        if (!file) throw new BadRequestException('Arquivo de imagem não enviado.');
        return await this.cover.upload(req.user!.id, params.playlistId, file);
    }

    // ...ou gerada pela IA a partir do humor da playlist (1 crédito).
    @Post('journey-playlist/spotify-playlist/:playlistId/cover/generate')
    @UseGuards(JwtAuthGuard)
    async generateCover(@Req() req: MRequest, @Param() params: PlaylistIdParamDto, @Body() dto: GenerateCoverDto) {
        return await this.cover.generate(req.user!.id, params.playlistId, dto.sentiment);
    }

    // Depois da revisão: só as músicas escolhidas vão para a fila.
    @Post('journey-playlist/queue')
    @UseGuards(JwtAuthGuard)
    async queueJourneyPlaylist(@Req() req: MRequest, @Body() dto: QueueJourneyDto) {
        return await this.journeyPlaylist.queue(req.user!.id, dto);
    }
}
