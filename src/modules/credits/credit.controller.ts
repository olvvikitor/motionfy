import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/shared/auth/jwt/authGuardService';
import type { MRequest } from 'src/modules/user/controllers/user.controller';
import { CreditService } from './credit.service';

@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditController {
    constructor(private readonly creditService: CreditService) {}

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

    /** Simula compra de um pacote */
    @Post('purchase')
    async purchase(@Body() body: { packageId: string }, @Req() req: MRequest) {
        return this.creditService.purchasePackage(req.user!.id, body.packageId);
    }
}
