import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { CreditService } from './credit.service';
import { StripeCheckoutService } from './stripe-checkout.service';

// Para onde o Stripe devolve o usuário: FRONTEND_URL em produção; em dev, a origem da chamada.
function frontendUrl(req: Request): string {
    const url = process.env.FRONTEND_URL ?? req.headers.origin;
    if (!url) throw new BadRequestException('Origem desconhecida.');
    return url.replace(/\/$/, '');
}

@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditController {
    constructor(
        private readonly creditService: CreditService,
        private readonly checkout: StripeCheckoutService,
    ) { }

    /** Saldo + histórico + imagens geradas + pacotes disponíveis */
    @Get('status')
    async getStatus(@Req() req: MRequest) {
        return this.creditService.getStatus(req.user!.id);
    }

    /** Apenas saldo (chamada leve para exibir no header) */
    @Get('balance')
    async getBalance(@Req() req: MRequest) {
        return this.creditService.getBalance(req.user!.id);
    }

    /** Abre o pagamento no Stripe; o app redireciona para a url devolvida. */
    @Post('checkout')
    async createCheckout(@Body() body: { packageId?: string }, @Req() req: MRequest) {
        if (!body?.packageId) throw new BadRequestException('Pacote não informado.');
        return this.checkout.createCheckout(req.user!.id, body.packageId, frontendUrl(req));
    }

    /** Na volta do Stripe: confirma a compra sem esperar o webhook. */
    @Post('checkout/confirm')
    @HttpCode(200)
    async confirmCheckout(@Body() body: { sessionId?: string }, @Req() req: MRequest) {
        if (!body?.sessionId) throw new BadRequestException('Sessão não informada.');
        return this.checkout.confirm(req.user!.id, body.sessionId);
    }
}

// Sem login: quem chama é o Stripe. A autenticidade vem da assinatura (STRIPE_WEBHOOK_SECRET),
// verificada sobre o corpo cru da requisição (rawBody no main.ts).
@Controller('credits/stripe')
export class StripeWebhookController {
    constructor(private readonly checkout: StripeCheckoutService) { }

    @Post('webhook')
    @HttpCode(200)
    async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
        await this.checkout.handleWebhook(req.rawBody, signature);
        return { received: true };
    }
}
