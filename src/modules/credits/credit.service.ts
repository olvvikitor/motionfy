import { BadRequestException, Injectable } from '@nestjs/common';
import { CreditLogType } from '@prisma/client';
import { CreditRepository } from './credit.repository';

export const PACKAGES = [
    {
        id: 'p1',
        credits: 1,
        price: 290,
        label: '1 crédito',
        tag: null,
        popular: false,
        description: 'Uma capa gerada pela IA ou três playlists de 60 min.',
    },
    {
        id: 'p5',
        credits: 5,
        price: 990,
        label: '5 créditos',
        tag: 'Mais vendido',
        popular: true,
        description: 'Capas novas e playlists longas para a semana.',
    },
    {
        id: 'p15',
        credits: 15,
        price: 1790,
        label: '15 créditos',
        tag: 'Melhor valor',
        popular: false,
        description: 'Para quem cria sempre e quer pagar menos por crédito.',
    },
] as const;

@Injectable()
export class CreditService {
    constructor(private readonly repo: CreditRepository) {}

    async getBalance(userId: string) {
        const balance = await this.repo.getBalance(userId);
        return { balance };
    }

    async getStatus(userId: string) {
        const [balance, logs, covers] = await Promise.all([
            this.repo.getBalance(userId),
            this.repo.getLogs(userId, 5),
            this.repo.getRecentCovers(userId, 6),
        ]);
        return { balance, logs, covers, packages: PACKAGES };
    }

    // Debita `amount` créditos (capa = 1; playlist longa = 0,30 a 0,75). `missing`: mensagem quando o saldo não cobre.
    async consumeCredit(userId: string, note: string, amount = 1, missing = 'Sem créditos disponíveis.'): Promise<{ remaining: number }> {
        const remaining = await this.repo.consume(userId, amount, note);
        if (remaining === null) {
            throw new BadRequestException(missing);
        }
        return { remaining };
    }

    // Devolve o que foi debitado quando a geração paga falha depois do débito.
    async refundCredit(userId: string, note: string, amount = 1): Promise<{ balance: number }> {
        const balance = await this.repo.add(userId, amount, CreditLogType.REFUND, note);
        return { balance };
    }

    async addBonus(userId: string, amount: number, note = 'Bônus'): Promise<{ balance: number }> {
        const balance = await this.repo.add(userId, amount, CreditLogType.BONUS, note);
        return { balance };
    }
}
