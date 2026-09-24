import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { AddToLibraryDto, LibrarySourceParamDto, LibraryTrackParamDto } from '../dtos/library.dto';
import { LibraryService } from '../services/library.service';

@Controller('user/library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
    constructor(private readonly library: LibraryService) { }

    // Músicas que já estão na biblioteca.
    @Get()
    async list(@Req() req: MRequest) {
        return await this.library.list(req.user!.id);
    }

    // Curtidas e playlists de onde o usuário pode puxar músicas.
    @Get('sources')
    async sources(@Req() req: MRequest) {
        return await this.library.sources(req.user!.id);
    }

    @Get('sources/:source')
    async sourceTracks(@Req() req: MRequest, @Param() params: LibrarySourceParamDto) {
        return await this.library.sourceTracks(req.user!.id, params.source);
    }

    @Post()
    async add(@Req() req: MRequest, @Body() dto: AddToLibraryDto) {
        return await this.library.add(req.user!.id, dto.items);
    }

    @Delete(':spotifyId')
    async remove(@Req() req: MRequest, @Param() params: LibraryTrackParamDto) {
        return await this.library.remove(req.user!.id, params.spotifyId);
    }
}
