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
        return Number(user?.image_credits ?? 0);
    }

    // Debita `amount` créditos (pode ser fração, ex.: 0,30) só se o saldo cobrir, numa única operação
    // (duas cobranças ao mesmo tempo não deixam o saldo negativo). Retorna null quando não há saldo.
    async consume(userId: string, amount: number, note: string): Promise<number | null> {
        return this.prisma.$transaction(async (tx) => {
            const { count } = await tx.user.updateMany({
                where: { id: userId, image_credits: { gte: amount } },
                data: { image_credits: { decrement: amount } },
            });
            if (count === 0) return null;

            await tx.creditLog.create({ data: { userId, type: CreditLogType.CONSUME, amount: -amount, note } });
            const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { image_credits: true } });
            return Number(user.image_credits);
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
        return Number(user.image_credits);
    }

    async getLogs(userId: string, limit = 10) {
        const logs = await this.prisma.creditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        // Decimal vira texto no JSON: devolve número.
        return logs.map(log => ({ ...log, amount: Number(log.amount) }));
    }

    // Últimas capas das playlists do usuário (é nelas que os créditos são gastos; o humor não tem mais imagem).
    async getRecentCovers(userId: string, limit = 6) {
        return this.prisma.mofyPlaylist.findMany({
            where: { userId, coverUrl: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: { id: true, coverUrl: true, title: true, sentiment: true, createdAt: true },
        });
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
            return Number(user.image_credits);
        });
    }

    async markPurchaseExpired(stripeSessionId: string) {
        await this.prisma.creditPurchase.updateMany({
            where: { stripeSessionId, status: "pending" },
            data: { status: "expired" },
        });
    }
}
