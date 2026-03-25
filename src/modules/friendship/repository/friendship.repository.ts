import { Inject, Injectable } from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from 'src/config/prisma.service';

@Injectable()
export class FriendshipRepository {
    constructor(@Inject() private prisma: PrismaService) {}

    async sendRequest(requesterId: string, addresseeId: string) {
        return this.prisma.friendship.create({
            data: { requesterId, addresseeId },
        });
    }

    async findRequest(requesterId: string, addresseeId: string) {
        return this.prisma.friendship.findUnique({
            where: { requesterId_addresseeId: { requesterId, addresseeId } },
        });
    }

    async findAnyRelation(userAId: string, userBId: string) {
        return this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: userAId, addresseeId: userBId },
                    { requesterId: userBId, addresseeId: userAId },
                ],
            },
        });
    }

    async updateStatus(id: string, status: FriendshipStatus) {
        return this.prisma.friendship.update({
            where: { id },
            data: { status },
        });
    }

    async delete(id: string) {
        return this.prisma.friendship.delete({ where: { id } });
    }

    async getPendingRequests(userId: string) {
        return this.prisma.friendship.findMany({
            where: { addresseeId: userId, status: 'PENDING' },
            include: {
                requester: {
                    select: { id: true, display_name: true, img_profile: true, country: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getFriends(userId: string) {
        return this.prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ requesterId: userId }, { addresseeId: userId }],
            },
            include: {
                requester: {
                    select: { id: true, display_name: true, img_profile: true, country: true },
                },
                addressee: {
                    select: { id: true, display_name: true, img_profile: true, country: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async searchUsers(query: string, currentUserId: string) {
        return this.prisma.user.findMany({
            where: {
                id: { not: currentUserId },
                display_name: { contains: query, mode: 'insensitive' },
            },
            select: { id: true, display_name: true, img_profile: true, country: true },
            take: 20,
        });
    }
}
