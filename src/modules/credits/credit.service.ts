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
        recommended: false,
        description: 'Perfeito para testar sua próxima arte.',
    },
    {
        id: 'p5',
        credits: 5,
        price: 990,
        label: '5 créditos',
        tag: 'Mais vendido',
        popular: true,
        recommended: true,
        description: 'Melhor equilíbrio entre preço e frequência de uso.',
    },
    {
        id: 'p15',
        credits: 15,
        price: 1790,
        label: '15 créditos',
        tag: 'Melhor valor',
        popular: false,
        recommended: false,
        description: 'Para quem quer gerar sem medo e pagar menos por imagem.',
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
        const [balance, logs, images] = await Promise.all([
            this.repo.getBalance(userId),
            this.repo.getLogs(userId, 5),
            this.repo.getGeneratedImages(userId, 6),
        ]);
        return { balance, logs, images, packages: PACKAGES };
    }

    async consumeCredit(userId: string, note?: string): Promise<{ remaining: number }> {
        const remaining = await this.repo.consume(userId, note);
        if (remaining === null) {
            throw new BadRequestException('Sem créditos disponíveis.');
        }
        return { remaining };
    }

    // Devolve o crédito quando a geração paga falha depois do débito.
    async refundCredit(userId: string, note = 'Estorno: falha na geração de imagem'): Promise<{ balance: number }> {
        const balance = await this.repo.add(userId, 1, CreditLogType.REFUND, note);
        return { balance };
    }

    async addBonus(userId: string, amount: number, note = 'Bônus'): Promise<{ balance: number }> {
        const balance = await this.repo.add(userId, amount, CreditLogType.BONUS, note);
        return { balance };
    }
}
