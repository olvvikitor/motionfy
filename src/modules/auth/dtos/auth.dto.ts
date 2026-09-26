import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginCredentialsDto {
    // Usuário do Last.fm ou e-mail (informado no cadastro).
    @IsNotEmpty({ message: 'Informe seu usuário do Last.fm ou e-mail.' })
    @IsString()
    login!: string;

    @IsNotEmpty({ message: 'A senha não pode estar vazia.' })
    @IsString()
    password!: string;
}

// Criado no cadastro: senha + e-mail (obrigatório; usado para entrar, promoções e notificações).
export class SetPasswordDto {
    @IsNotEmpty({ message: 'A senha não pode estar vazia.' })
    @IsString()
    @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
    password!: string;

    @IsEmail({}, { message: 'Informe um e-mail válido.' })
    email!: string;
}
