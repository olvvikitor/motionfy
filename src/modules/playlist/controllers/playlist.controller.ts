import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadFile } from 'src/shared/infra/storage/interfaces/file-storage.interface';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { GenerateCoverDto, JourneyPathQueryDto, JourneyPlaylistDto, MofyPlaylistIdParamDto, PlaylistIdParamDto, QueueJourneyDto, ReuseCoverDto, ShowcaseQueryDto, SpotifyPlaylistDto } from '../dtos/journey-playlist.dto';
import { JourneyPlaylistService } from '../services/journey-playlist.service';
import { MofyPlaylistService } from '../services/mofy-playlist.service';
import { PlaylistCoverService } from '../services/playlist-cover.service';

// Imagem enviada (capa pronta ou foto de referência): JPEG, PNG ou WEBP até 5 MB.
const IMAGE_UPLOAD = {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
        if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new BadRequestException('Apenas imagens JPEG, PNG ou WEBP.'), false);
        cb(null, true);
    },
};

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
    // Humores que podem vir junto com cada um (área no mapa do seletor).
    @Get('journey-playlist/mood-areas')
    @UseGuards(JwtAuthGuard)
    moodAreas() {
        return this.journeyPlaylist.areas();
    }

    @Post('journey-playlist/spotify-playlist')
    @UseGuards(JwtAuthGuard)
    async createSpotifyPlaylist(@Req() req: MRequest, @Body() dto: SpotifyPlaylistDto) {
        return await this.mofyPlaylist.create(req.user!.id, dto);
    }

    // Opções dos filtros da geração (gêneros, subgêneros e BPM das músicas do usuário).
    @Get('journey-playlist/filters')
    @UseGuards(JwtAuthGuard)
    async journeyFilters(@Req() req: MRequest) {
        return await this.journeyPlaylist.filterOptions(req.user!.id);
    }

    // Perfil: as playlists criadas com os dados do card, das mais novas, em páginas (?cursor=&limit=).
    @Get('mofy-playlists')
    @UseGuards(JwtAuthGuard)
    async listMofyPlaylists(@Req() req: MRequest, @Query() query: ShowcaseQueryDto) {
        return await this.mofyPlaylist.showcase(req.user!.id, query.cursor, query.limit);
    }

    // Biblioteca: todas as playlists criadas (também as que já saíram do Spotify), com as músicas guardadas no Mofy.
    @Get('mofy-playlists/library')
    @UseGuards(JwtAuthGuard)
    async listLibraryPlaylists(@Req() req: MRequest, @Query() query: ShowcaseQueryDto) {
        return await this.mofyPlaylist.library(req.user!.id, query.cursor, query.limit);
    }

    // "Abrir no Spotify": link da playlist, gerada de novo (com a capa) se já não estiver na conta do Mofy.
    @Post('mofy-playlists/:id/open')
    @UseGuards(JwtAuthGuard)
    async openMofyPlaylist(@Req() req: MRequest, @Param() params: MofyPlaylistIdParamDto) {
        return await this.mofyPlaylist.open(req.user!.id, params.id);
    }

    // Capas que o usuário já criou, para usar numa playlist nova.
    @Get('mofy-playlists/covers')
    @UseGuards(JwtAuthGuard)
    async listCovers(@Req() req: MRequest) {
        return await this.cover.saved(req.user!.id);
    }

    // Baixar a capa guardada de uma playlist (JPEG).
    @Get('mofy-playlists/:id/cover')
    @UseGuards(JwtAuthGuard)
    async downloadCover(@Req() req: MRequest, @Param() params: MofyPlaylistIdParamDto) {
        const image = await this.cover.download(req.user!.id, params.id);
        return new StreamableFile(image, { type: 'image/jpeg', disposition: 'attachment; filename="mofy-capa.jpg"' });
    }

    // Gera de novo no Spotify (mesmas músicas, título e capa) uma playlist que já saiu da conta do Mofy.
    @Post('mofy-playlists/:id/recreate')
    @UseGuards(JwtAuthGuard)
    async recreateMofyPlaylist(@Req() req: MRequest, @Param() params: MofyPlaylistIdParamDto) {
        return await this.mofyPlaylist.recreate(req.user!.id, params.id);
    }

    // Capa da playlist criada: imagem do usuário (multipart "file")...
    @Post('journey-playlist/spotify-playlist/:playlistId/cover')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD))
    async uploadCover(@Req() req: MRequest, @Param() params: PlaylistIdParamDto, @UploadedFile() file: UploadFile) {
        if (!file) throw new BadRequestException('Arquivo de imagem não enviado.');
        return await this.cover.upload(req.user!.id, params.playlistId, file);
    }

    // ...ou gerada pela IA a partir do humor da playlist (1 crédito), com a foto do perfil, uma foto
    // enviada agora ("file": selfie vira personagem, paisagem/objeto vira cenário) ou sem foto.
    @Post('journey-playlist/spotify-playlist/:playlistId/cover/generate')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD))
    async generateCover(@Req() req: MRequest, @Param() params: PlaylistIdParamDto, @Body() dto: GenerateCoverDto, @UploadedFile() file?: UploadFile) {
        const reference = dto.reference ?? 'profile';
        if (reference === 'photo' && !file) throw new BadRequestException('Foto de referência não enviada.');
        return await this.cover.generate(req.user!.id, params.playlistId, dto.sentiment, reference === 'photo' ? { photo: file! } : reference);
    }

    // ...ou uma capa que o usuário já criou em outra playlist (grátis).
    @Post('journey-playlist/spotify-playlist/:playlistId/cover/reuse')
    @UseGuards(JwtAuthGuard)
    async reuseCover(@Req() req: MRequest, @Param() params: PlaylistIdParamDto, @Body() dto: ReuseCoverDto) {
        return await this.cover.reuse(req.user!.id, params.playlistId, dto.fromId);
    }

    // Depois da revisão: só as músicas escolhidas vão para a fila.
    @Post('journey-playlist/queue')
    @UseGuards(JwtAuthGuard)
    async queueJourneyPlaylist(@Req() req: MRequest, @Body() dto: QueueJourneyDto) {
        return await this.journeyPlaylist.queue(req.user!.id, dto);
    }
}
