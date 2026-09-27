import { IsEmail } from 'class-validator';

// Informações pessoais: e-mail (promoções e notificações). Um por conta.
export class SetEmailDto {
    @IsEmail({}, { message: 'Informe um e-mail válido.' })
    email!: string;
}
