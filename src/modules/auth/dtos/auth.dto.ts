import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginCredentialsDto {
    @IsEmail({}, { message: 'Por favor, forneça um endereço de e-mail válido.' })
    email!: string;

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
