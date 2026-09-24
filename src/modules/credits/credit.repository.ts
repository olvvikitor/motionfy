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

    // Últimas imagens geradas pelo usuário. A imagem passa para os humores seguintes, então
    // pega uma linha por imagem: a do humor em que ela foi gerada.
    async getGeneratedImages(userId: string, limit = 6) {
        const rows = await this.prisma.moodAnalysis.findMany({
            where: { userId, image_mood: { not: null } },
            orderBy: { analyzedAt: 'asc' },
            distinct: ['image_mood'],
            select: {
                id: true,
                image_mood: true,
                sentiment: true,
                moodScore: true,
                analyzedAt: true,
            },
        });
        return rows.reverse().slice(0, limit);
    }

    // ── Compras (Stripe) ──────────────────────────────────────────────────────

    async createPurchase(data: {
        userId: string;
        stripeSessionId: string;
        packageId: string;
        credits: number;
        amountCents: number;
        currency: string;
    }) {
        return this.prisma.creditPurchase.create({ data });
    }

    async getPurchaseBySession(stripeSessionId: string) {
        return this.prisma.creditPurchase.findUnique({ where: { stripeSessionId } });
    }

    // Marca como paga e credita, numa transação. Só a primeira chamada credita: as
    // seguintes (webhook repetido, confirmação na volta) não acham mais linha pendente.
    // Retorna o saldo novo, ou null se já tinha sido creditada / não existe.
    async fulfillPurchase(stripeSessionId: string): Promise<number | null> {
        return this.prisma.$transaction(async (tx) => {
            const purchase = await tx.creditPurchase.findUnique({ where: { stripeSessionId } });
            if (!purchase) return null;

            const { count } = await tx.creditPurchase.updateMany({
                where: { stripeSessionId, status: { not: "paid" } },
                data: { status: "paid", paidAt: new Date() },
            });
            if (count === 0) return null;

            const user = await tx.user.update({
                where: { id: purchase.userId },
                data: {
                    image_credits: { increment: purchase.credits },
                    creditLogs: {
                        create: {
                            type: CreditLogType.PURCHASE,
                            amount: purchase.credits,
                            note: `Compra: ${purchase.credits} crédito(s) | stripe ${stripeSessionId}`,
                        },
                    },
                },
                select: { image_credits: true },
            });
            return user.image_credits;
        });
    }

    async markPurchaseExpired(stripeSessionId: string) {
        await this.prisma.creditPurchase.updateMany({
            where: { stripeSessionId, status: "pending" },
            data: { status: "expired" },
        });
    }
}
