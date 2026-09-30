import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { LibraryService } from '../services/library.service';

@Controller('user/library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
    constructor(private readonly library: LibraryService) { }

    // Todas as músicas que o usuário já ouviu (histórico), das tocadas mais recentemente.
    @Get()
    async list(@Req() req: MRequest) {
        return await this.library.list(req.user!.id);
    }
}
