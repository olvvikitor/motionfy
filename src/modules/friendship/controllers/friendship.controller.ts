import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { FriendshipService } from '../services/friendship.service';
import { RespondFriendRequestDto, SendFriendRequestDto } from '../dto/friendship.dto';

@Controller('friendship')
@UseGuards(JwtAuthGuard)
export class FriendshipController {
    constructor(private readonly friendshipService: FriendshipService) {}

    /** Buscar usuários pelo nome */
    @Get('search')
    async searchUsers(@Query('q') query: string, @Req() req: MRequest) {
        return this.friendshipService.searchUsers(query, req.user!.id);
    }

    /** Listar amigos aceitos */
    @Get()
    async getFriends(@Req() req: MRequest) {
        return this.friendshipService.getFriends(req.user!.id);
    }

    /** Listar solicitações pendentes recebidas */
    @Get('requests')
    async getPendingRequests(@Req() req: MRequest) {
        return this.friendshipService.getPendingRequests(req.user!.id);
    }

    /** Mood atual de um amigo */
    @Get(':friendId/mood')
    async getFriendMood(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendMood(req.user!.id, friendId);
    }

    /** Música que o amigo está ouvindo agora */
    @Get(':friendId/listening-now')
    async getFriendListeningNow(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendListeningNow(req.user!.id, friendId);
    }

    /** Comparação de mood entre o usuário e um amigo */
    @Get(':friendId/compare-mood')
    async compareMood(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.compareMood(req.user!.id, friendId);
    }

    /** Enviar solicitação de amizade */
    @Post('request')
    async sendRequest(@Body() dto: SendFriendRequestDto, @Req() req: MRequest) {
        return this.friendshipService.sendRequest(req.user!.id, dto.addresseeId);
    }

    /** Aceitar ou recusar solicitação */
    @Put('respond')
    async respondRequest(@Body() dto: RespondFriendRequestDto, @Req() req: MRequest) {
        return this.friendshipService.respondRequest(req.user!.id, dto.friendshipId, dto.accept);
    }

    /** Remover amigo */
    @Delete(':id')
    async removeFriend(@Param('id') id: string, @Req() req: MRequest) {
        return this.friendshipService.removeFriend(req.user!.id, id);
    }
}
