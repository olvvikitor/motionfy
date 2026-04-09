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
    constructor(private readonly friendshipService: FriendshipService) { }

    @Get('search')
    async searchUsers(@Query('q') query: string, @Req() req: MRequest) {
        return this.friendshipService.searchUsers(query, req.user!.id);
    }

    @Get()
    async getFriends(@Req() req: MRequest) {
        return this.friendshipService.getFriends(req.user!.id);
    }

    @Get('requests')
    async getPendingRequests(@Req() req: MRequest) {
        return this.friendshipService.getPendingRequests(req.user!.id);
    }

    @Get(':friendId/mood')
    async getFriendMood(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendMood(req.user!.id, friendId);
    }

    @Get(':friendId/listening-now')
    async getFriendListeningNow(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendListeningNow(req.user!.id, friendId);
    }

    @Get(':friendId/compare-mood')
    async compareMood(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.compareMood(req.user!.id, friendId);
    }

    // ─── Perfil público do amigo ──────────────────────────────────────────────

    @Get(':friendId/mood-history')
    async getFriendMoodHistory(
        @Param('friendId') friendId: string,
        @Req() req: MRequest,
        @Query('limit') limit?: string,
    ) {
        const parsed = limit ? parseInt(limit, 10) : 20;
        return this.friendshipService.getFriendMoodHistory(
            req.user!.id,
            friendId,
            isNaN(parsed) ? 20 : parsed,
        );
    }

    @Get(':friendId/mood-week')
    async getFriendMoodWeek(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendMoodWeek(req.user!.id, friendId);
    }

    @Get(':friendId/stats')
    async getFriendStats(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendStats(req.user!.id, friendId);
    }

    // ─── Friendship CRUD ──────────────────────────────────────────────────────

    @Post('request')
    async sendRequest(@Body() dto: SendFriendRequestDto, @Req() req: MRequest) {
        return this.friendshipService.sendRequest(req.user!.id, dto.addresseeId);
    }

    @Put('respond')
    async respondRequest(@Body() dto: RespondFriendRequestDto, @Req() req: MRequest) {
        return this.friendshipService.respondRequest(req.user!.id, dto.friendshipId, dto.accept);
    }

    @Delete(':id')
    async removeFriend(@Param('id') id: string, @Req() req: MRequest) {
        return this.friendshipService.removeFriend(req.user!.id, id);
    }

    @Post('mood/:moodId/reaction')
    async toggleReaction(
        @Param('moodId') moodId: string,
        @Body('emoji') emoji: string,
        @Req() req: MRequest,
    ) {
        return this.friendshipService.toggleReaction(req.user!.id, moodId, emoji);
    }

    @Post('mood/:moodId/comment')
    async addComment(
        @Param('moodId') moodId: string,
        @Body('text') text: string,
        @Req() req: MRequest,
    ) {
        return this.friendshipService.addComment(req.user!.id, moodId, text);
    }
}
