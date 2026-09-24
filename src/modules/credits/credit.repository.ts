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

    // Debita 1 crédito só se houver saldo, numa única operação (duas gerações ao mesmo
    // tempo não deixam o saldo negativo). Retorna null quando não há crédito.
    async consume(userId: string, note = 'Geração de imagem'): Promise<number | null> {
        return this.prisma.$transaction(async (tx) => {
            const { count } = await tx.user.updateMany({
                where: { id: userId, image_credits: { gt: 0 } },
                data: { image_credits: { decrement: 1 } },
            });
            if (count === 0) return null;

            await tx.creditLog.create({ data: { userId, type: CreditLogType.CONSUME, amount: -1, note } });
            const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { image_credits: true } });
            return user.image_credits;
        });
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
