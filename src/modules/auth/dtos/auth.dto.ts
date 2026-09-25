import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginCredentialsDto {
    // Usuário do Last.fm (contas novas) ou e-mail (contas antigas do Spotify).
    @IsNotEmpty({ message: 'Informe seu usuário do Last.fm.' })
    @IsString()
    login!: string;

    @IsNotEmpty({ message: 'A senha não pode estar vazia.' })
    @IsString()
    password!: string;
}

export class SetPasswordDto {
    @IsNotEmpty({ message: 'A senha não pode estar vazia.' })
    @IsString()
    @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
    password!: string;
}
