import { Inject, Injectable } from '@nestjs/common';
import { CreditLogType } from '@prisma/client';
import { PrismaService } from 'src/config/prisma.service';

@Injectable()
export class CreditRepository {
    constructor(@Inject() private prisma: PrismaService) {}

    async getBalance(userId: string): Promise<number> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { image_credits: true },
        });
        return user?.image_credits ?? 0;
    }

    async consume(userId: string): Promise<number> {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                image_credits: { decrement: 1 },
                creditLogs: {
                    create: { type: CreditLogType.CONSUME, amount: -1, note: 'Geração de imagem' },
                },
            },
            select: { image_credits: true },
        });
        return user.image_credits;
    }

    async add(userId: string, amount: number, type: CreditLogType, note?: string): Promise<number> {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                image_credits: { increment: amount },
                creditLogs: {
                    create: { type, amount, note: note ?? '' },
                },
            },
            select: { image_credits: true },
        });
        return user.image_credits;
    }

    async getLogs(userId: string, limit = 10) {
        return this.prisma.creditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    // Últimas imagens geradas pelo usuário
    async getGeneratedImages(userId: string, limit = 6) {
        return this.prisma.moodAnalysis.findMany({
            where: { userId, image_mood: { not: null } },
            orderBy: { analyzedAt: 'desc' },
            take: limit,
            select: {
                id: true,
                image_mood: true,
                sentiment: true,
                moodScore: true,
                analyzedAt: true,
            },
        });
    }
}
