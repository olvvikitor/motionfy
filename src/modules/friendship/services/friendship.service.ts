import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { FriendshipRepository } from '../repository/friendship.repository';
import { PrismaService } from 'src/config/prisma.service';
import { MOOD_WINDOW_MINUTES, UserService } from 'src/modules/user/services/user.service';
import { MofyPlaylistService } from 'src/modules/playlist/services/mofy-playlist.service';
import { PetService } from 'src/modules/pet/services/pet.service';

@Injectable()
export class FriendshipService {
    constructor(
        private readonly friendshipRepository: FriendshipRepository,
        private readonly prisma: PrismaService,
        private readonly userService: UserService,
        private readonly playlists: MofyPlaylistService,
        private readonly pets: PetService,
    ) { }

    // ─── Helpers privados ────────────────────────────────────────────────────

    private async assertFriends(userId: string, friendId: string) {
        if (!(await this.areFriends(userId, friendId))) throw new ForbiddenException('Vocês não são amigos.');
    }

    async areFriends(userId: string, otherId: string): Promise<boolean> {
        const relation = await this.friendshipRepository.findAnyRelation(userId, otherId);
        return relation?.status === 'ACCEPTED';
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

    // O humor de um amigo só se recalcula quando o app dele está aberto: ouvindo sem abrir, o último fica parado.
    // Para quem vê de fora, humor que não se renovou na janela também é "sem humor agora" (idle).
    async getFriendMood(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        const mood = await this.userService.getMoodUserToday(friendId);
        if (!mood) return mood;
        const stale = Date.now() - new Date(mood.analyzedAt).getTime() > MOOD_WINDOW_MINUTES * 60_000;
        return stale ? { ...mood, idle: true } : mood;
    }

    async getFriendListeningNow(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        return this.userService.listeningNow(friendId);
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

    /** Músicas que o amigo ouviu hoje (as mesmas do "Últimas faixas" do perfil) */
    async getFriendTodayTracks(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        return this.userService.getTodayTracksAnalyzed(friendId);
    }

    /** Playlists que o amigo criou, como no topo do perfil dele */
    async getFriendPlaylists(userId: string, friendId: string, cursor?: string, limit?: number) {
        await this.assertFriends(userId, friendId);
        return this.playlists.showcase(friendId, cursor, limit);
    }

    /** Músicas de uma playlist sua ou de um amigo (a que já saiu do Spotify abre música por música) */
    async getPlaylistTracks(userId: string, ownerId: string, playlistId: string) {
        if (ownerId !== userId) await this.assertFriends(userId, ownerId);
        return this.playlists.tracksOf(ownerId, playlistId);
    }

    /** Bichinho do amigo ({ pet: null } se ele não criou) */
    async getFriendPet(userId: string, friendId: string) {
        await this.assertFriends(userId, friendId);
        return this.pets.get(friendId);
    }
}
