import { Module } from '@nestjs/common';
import { CreditRepository } from './credit.repository';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';
import { ConfigModuleAplication } from 'src/config/config.module';
import { JwtModuleProvider } from 'src/shared/auth/jwt/JwtModuleProvider';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [ConfigModuleAplication, JwtModuleProvider, AuthModule],
    controllers: [CreditController],
    providers: [CreditRepository, CreditService],
    exports: [CreditService],
})
export class CreditModule {}
