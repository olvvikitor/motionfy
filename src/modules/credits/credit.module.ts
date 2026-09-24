import { Module } from '@nestjs/common';
import { CreditRepository } from './credit.repository';
import { CreditService } from './credit.service';
import { CreditController, StripeWebhookController } from './credit.controller';
import { StripeCheckoutService } from './stripe-checkout.service';
import { ConfigModuleAplication } from 'src/config/config.module';
import { JwtModuleProvider } from 'src/shared/auth/jwt/JwtModuleProvider';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider, AuthModule],
    controllers: [CreditController, StripeWebhookController],
    providers: [CreditRepository, CreditService, StripeCheckoutService],
    exports: [CreditService],
})
export class CreditModule {}
