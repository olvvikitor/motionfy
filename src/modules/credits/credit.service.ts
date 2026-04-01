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

    async consumeCredit(userId: string): Promise<{ remaining: number }> {
        const balance = await this.repo.getBalance(userId);
        if (balance <= 0) {
            throw new BadRequestException('Sem créditos disponíveis.');
        }
        const remaining = await this.repo.consume(userId);
        return { remaining };
    }

    // Simula compra (sem gateway real por ora — retorna sucesso direto)
    async purchasePackage(userId: string, packageId: string, source = 'unknown'): Promise<{ balance: number }> {
        const pkg = PACKAGES.find(p => p.id === packageId);
        if (!pkg) throw new BadRequestException('Pacote inválido.');

        const balance = await this.repo.add(
            userId,
            pkg.credits,
            CreditLogType.PURCHASE,
            `Compra: ${pkg.label} | source: ${source}`,
        );

        return { balance };
    }

    async addBonus(userId: string, amount: number, note = 'Bônus'): Promise<{ balance: number }> {
        const balance = await this.repo.add(userId, amount, CreditLogType.BONUS, note);
        return { balance };
    }
}
