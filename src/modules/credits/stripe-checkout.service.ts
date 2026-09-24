import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from 'src/config/prisma.service';
import { CreditRepository } from './credit.repository';
import { PACKAGES } from './credit.service';

// Compra de créditos pelo Stripe Checkout (página de pagamento hospedada pelo Stripe).
// Fluxo: createCheckout → usuário paga no Stripe → webhook (ou confirm, na volta) credita.
// O crédito só entra uma vez por sessão (ver CreditRepository.fulfillPurchase).
@Injectable()
export class StripeCheckoutService {
    private readonly logger = new Logger(StripeCheckoutService.name);
    private client: Stripe | null = null;

    constructor(
        private readonly repo: CreditRepository,
        private readonly prisma: PrismaService,
    ) { }

    private get stripe(): Stripe {
        if (this.client) return this.client;
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new ServiceUnavailableException('Pagamento indisponível no momento.');
        this.client = new Stripe(key);
        return this.client;
    }

    async createCheckout(userId: string, packageId: string, frontendUrl: string): Promise<{ url: string }> {
        const pkg = PACKAGES.find(p => p.id === packageId);
        if (!pkg) throw new BadRequestException('Pacote inválido.');

        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user) throw new NotFoundException('Usuário não encontrado.');

        const session = await this.stripe.checkout.sessions.create({
            mode: 'payment',
            locale: 'pt-BR',
            client_reference_id: userId,
            customer_email: user.email ?? undefined,
            metadata: { userId, packageId: pkg.id },
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: 'brl',
                    unit_amount: pkg.price,
                    product_data: {
                        name: `Mofy · ${pkg.label}`,
                        description: `${pkg.credits} ${pkg.credits === 1 ? 'imagem' : 'imagens'} de humor`,
                    },
                },
            }],
            success_url: `${frontendUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/dashboard?checkout=cancel`,
        });

        if (!session.url) throw new ServiceUnavailableException('Não foi possível abrir o pagamento.');

        await this.repo.createPurchase({
            userId,
            stripeSessionId: session.id,
            packageId: pkg.id,
            credits: pkg.credits,
            amountCents: pkg.price,
            currency: 'brl',
        });

        return { url: session.url };
    }

    // Chamado pelo app na volta do checkout: não depende do webhook ter chegado.
    async confirm(userId: string, sessionId: string): Promise<{ status: 'paid' | 'pending' | 'expired'; balance: number }> {
        const purchase = await this.repo.getPurchaseBySession(sessionId);
        if (!purchase || purchase.userId !== userId) throw new NotFoundException('Compra não encontrada.');

        if (purchase.status === 'pending') {
            const session = await this.stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === 'paid') await this.repo.fulfillPurchase(sessionId);
            else if (session.status === 'expired') await this.repo.markPurchaseExpired(sessionId);
        }

        const [updated, balance] = await Promise.all([
            this.repo.getPurchaseBySession(sessionId),
            this.repo.getBalance(userId),
        ]);
        return { status: (updated?.status ?? 'pending') as 'paid' | 'pending' | 'expired', balance };
    }

    async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) throw new ServiceUnavailableException('Webhook não configurado.');
        if (!rawBody || !signature) throw new BadRequestException('Assinatura ausente.');

        let event: Stripe.Event;
        try {
            event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
        } catch {
            throw new BadRequestException('Assinatura inválida.');
        }

        switch (event.type) {
            // Cartão: paga na hora. Pix/boleto: "completed" chega com payment_status "unpaid"
            // e o pagamento vem depois em "async_payment_succeeded".
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded': {
                const session = event.data.object;
                if (session.payment_status === 'paid') {
                    const balance = await this.repo.fulfillPurchase(session.id);
                    if (balance !== null) this.logger.log(`Créditos adicionados (sessão ${session.id})`);
                }
                break;
            }
            case 'checkout.session.async_payment_failed':
            case 'checkout.session.expired':
                await this.repo.markPurchaseExpired(event.data.object.id);
                break;
        }
    }
}
