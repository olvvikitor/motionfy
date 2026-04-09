import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { FriendshipRepository } from '../repository/friendship.repository';
import { PrismaService } from 'src/config/prisma.service';
import { UserService } from 'src/modules/user/services/user.service';

@Injectable()
export class FriendshipService {
    constructor(
        private readonly friendshipRepository: FriendshipRepository,
        private readonly prisma: PrismaService,
        private readonly userService: UserService,
    ) { }

    // ─── Helpers privados ────────────────────────────────────────────────────

    private async assertFriends(userId: string, friendId: string) {
        const relation = await this.friendshipRepository.findAnyRelation(userId, friendId);
        if (!relation || relation.status !== 'ACCEPTED') {
            throw new ForbiddenException('Vocês não são amigos.');
        }
    }

    // ─── Friendship CRUD ────────────────────────────────────────────────────

    async sendRequest(requesterId: string, addresseeId: string) {
        if (requesterId === addresseeId) {
            throw new BadRequestException('Você não pode adicionar a si mesmo.');
        }

        const existing = await this.friendshipRepository.findAnyRelation(requesterId, addresseeId);

        if (existing) {
            if (existing.status === 'ACCEPTED') throw new BadRequestException('Vocês já são amigos.');
            if (existing.status === 'PENDING') throw new BadRequestException('Solicitação já enviada ou pendente.');
            if (existing.status === 'BLOCKED') throw new ForbiddenException('Não é possível enviar solicitação.');
            await this.friendshipRepository.delete(existing.id);
        }

        return this.friendshipRepository.sendRequest(requesterId, addresseeId);
    }

    async respondRequest(userId: string, friendshipId: string, accept: boolean) {
        const record = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });

        if (!record) throw new NotFoundException('Solicitação não encontrada.');
        if (record.addresseeId !== userId) throw new ForbiddenException('Sem permissão.');
        if (record.status !== 'PENDING') throw new BadRequestException('Solicitação já respondida.');

        return this.friendshipRepository.updateStatus(friendshipId, accept ? 'ACCEPTED' : 'REJECTED');
    }

    async removeFriend(userId: string, friendshipId: string) {
        const record = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });

        if (!record) throw new NotFoundException('Amizade não encontrada.');
        if (record.requesterId !== userId && record.addresseeId !== userId) {
            throw new ForbiddenException('Sem permissão.');
        }

        return this.friendshipRepository.delete(friendshipId);
    }

    async getPendingRequests(userId: string) {
        return this.friendshipRepository.getPendingRequests(userId);
    }

    async getFriends(userId: string) {
        const records = await this.friendshipRepository.getFriends(userId);

        return records.map((f) => {
            const friend = f.requesterId === userId ? f.addressee : f.requester;
            return {
                friendshipId: f.id,
                since: f.updatedAt,
                ...friend,
            };
        });
    }

    async searchUsers(query: string, currentUserId: string) {
        if (!query || query.trim().length < 2) {
            throw new BadRequestException('A busca precisa ter pelo menos 2 caracteres.');
        }

        const users = await this.friendshipRepository.searchUsers(query.trim(), currentUserId);

        const withStatus = await Promise.all(
            users.map(async (u) => {
                const relation = await this.friendshipRepository.findAnyRelation(currentUserId, u.id);
                return {
                    ...u,
                    friendshipStatus: relation?.status ?? null,
                    friendshipId: relation?.id ?? null,
                };
            }),
        );

        return withStatus;
    }

    // ─── Funcionalidades sociais ─────────────────────────────────────────────

    async getFriendMood(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        return this.userService.getMoodUserToday(friendId);
    }

    async getFriendListeningNow(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        return this.userService.listeningNow(friendId);
    }

    async compareMood(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);

        const [myMood, friendMood, friendInfo] = await Promise.all([
            this.userService.getMoodUserToday(userId),
            this.userService.getMoodUserToday(friendId),
            this.prisma.user.findUnique({
                where: { id: friendId },
                select: { display_name: true, img_profile: true },
            }),
        ]);

        return {
            me: myMood,
            friend: {
                ...friendMood,
                display_name: friendInfo?.display_name,
                img_profile: friendInfo?.img_profile,
            },
        };
    }

    // ─── Perfil público do amigo ─────────────────────────────────────────────

    /** Histórico de moods do amigo (últimos N) */
    async getFriendMoodHistory(userId: string, friendId: string, limit = 20) {
        await this.assertFriends(userId, friendId);
        return this.userService.getMoodHistory(friendId, limit);
    }

    /** Moods dos últimos 7 dias do amigo */
    async getFriendMoodWeek(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        return this.userService.getMoodWeek(friendId);
    }

    /** Estatísticas gerais do amigo */
    async getFriendStats(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        return this.userService.getUserStats(friendId);
    }

    async toggleReaction(userId: string, moodId: string, emoji: string) {
        const existing = await this.prisma.moodReaction.findUnique({
            where: { moodAnalysisId_userId: { moodAnalysisId: moodId, userId } }
        });

        if (existing) {
            if (existing.emoji === emoji) {
                await this.prisma.moodReaction.delete({ where: { id: existing.id } });
                return { action: 'removed' };
            } else {
                await this.prisma.moodReaction.update({ where: { id: existing.id }, data: { emoji } });
                return { action: 'updated', emoji };
            }
        } else {
            await this.prisma.moodReaction.create({
                data: { moodAnalysisId: moodId, userId, emoji }
            });
            return { action: 'added', emoji };
        }
    }

    async addComment(userId: string, moodId: string, text: string) {
        return this.prisma.moodComment.create({
            data: { moodAnalysisId: moodId, userId, text },
            include: {
                user: { select: { id: true, display_name: true, img_profile: true } }
            }
        });
    }
}
