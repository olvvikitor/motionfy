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
import { ShowcaseQueryDto } from 'src/modules/playlist/dtos/journey-playlist.dto';
import { FriendshipService } from '../services/friendship.service';
import { FeedService } from '../services/feed.service';
import {
    FeedCommentDto, FeedQueryDto, FeedReactionDto, FeedTargetParamDto, PlaylistOwnerParamDto,
    RespondFriendRequestDto, SendFriendRequestDto,
} from '../dto/friendship.dto';

@Controller('friendship')
@UseGuards(JwtAuthGuard)
export class FriendshipController {
    constructor(
        private readonly friendshipService: FriendshipService,
        private readonly feedService: FeedService,
    ) { }

    @Get('search')
    async searchUsers(@Query('q') query: string, @Req() req: MRequest) {
        return this.friendshipService.searchUsers(query, req.user!.id);
    }

    @Get()
    async getFriends(@Req() req: MRequest) {
        return this.friendshipService.getFriends(req.user!.id);
    }

    // ─── Feed (precisa vir antes das rotas ':friendId/...') ───────────────────

    // Playlists criadas e trocas de humor (suas e dos amigos), do mais novo, em páginas (?before=&limit=).
    @Get('feed')
    async getFeed(@Req() req: MRequest, @Query() query: FeedQueryDto) {
        return this.feedService.feed(req.user!.id, query.before, query.limit);
    }

    // Amigos tocando algo agora (faixa do topo do feed).
    @Get('live')
    async getLive(@Req() req: MRequest) {
        return this.feedService.live(req.user!.id);
    }

    @Post('feed/:kind/:id/reaction')
    async toggleReaction(@Req() req: MRequest, @Param() params: FeedTargetParamDto, @Body() dto: FeedReactionDto) {
        return this.feedService.toggleReaction(req.user!.id, params.kind, params.id, dto.emoji);
    }

    @Post('feed/:kind/:id/comment')
    async addComment(@Req() req: MRequest, @Param() params: FeedTargetParamDto, @Body() dto: FeedCommentDto) {
        return this.feedService.addComment(req.user!.id, params.kind, params.id, dto.text);
    }

    @Get('requests')
    async getPendingRequests(@Req() req: MRequest) {
        return this.friendshipService.getPendingRequests(req.user!.id);
    }

    // ─── Perfil do amigo ──────────────────────────────────────────────────────

    @Get(':friendId/mood')
    async getFriendMood(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendMood(req.user!.id, friendId);
    }

    @Get(':friendId/listening-now')
    async getFriendListeningNow(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendListeningNow(req.user!.id, friendId);
    }

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

    @Get(':friendId/today-tracks')
    async getFriendTodayTracks(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendTodayTracks(req.user!.id, friendId);
    }

    @Get(':friendId/pet')
    async getFriendPet(@Param('friendId') friendId: string, @Req() req: MRequest) {
        return this.friendshipService.getFriendPet(req.user!.id, friendId);
    }

    @Get(':friendId/playlists')
    async getFriendPlaylists(@Param('friendId') friendId: string, @Req() req: MRequest, @Query() query: ShowcaseQueryDto) {
        return this.friendshipService.getFriendPlaylists(req.user!.id, friendId, query.cursor, query.limit);
    }

    // Músicas de uma playlist sua ou de um amigo (no feed e no perfil, quando ela já saiu do Spotify).
    @Get(':ownerId/playlists/:id/tracks')
    async getPlaylistTracks(@Param() params: PlaylistOwnerParamDto, @Req() req: MRequest) {
        return this.friendshipService.getPlaylistTracks(req.user!.id, params.ownerId, params.id);
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
}
