import { Inject, Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { User } from "@prisma/client";
import { CreateUserService } from "src/modules/user/services/create.user.service";
import { UserRepository } from "src/modules/user/repository/user.repository";
import { JwtService } from "@nestjs/jwt";
import { LoginCredentialsDto, SetPasswordDto } from "../dtos/auth.dto";
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        @Inject() private provideFactory: MusicProviderFactory,
        @Inject() private createUserService: CreateUserService,
        @Inject() private userRepository: UserRepository,
        @Inject() private jwtService: JwtService
    ) { }

    async handleCallback(providerName: string, userData: any) {
        const provider = this.provideFactory.getProvider(providerName);
        const profile = await provider.getProfile(userData.accessToken)

        const user: User = {
            id: profile.id,
            email: profile.email,
            password: null,
            display_name: profile.displayName,
            country: profile.country,
            img_profile: profile.imageUrl ?? '',
            face_photo_path: null,
            preferredStudioId: null,
            image_credits: 1,
            provider: providerName,
            notificateEmail: false,
            notificatePush: false,
            notificateWeek: false,
            accessToken: userData.accessToken,
            refreshToken: userData.refreshToken
        }

        return await this.createUserService.create(user, providerName);
    }

    async login(credentials: LoginCredentialsDto) {
        const users = await this.userRepository.getUsersByEmail(credentials.email);
        const passwordUser = users.find(user => Boolean(user.password));
        const providerOnlyUser = users[0];

        if (!passwordUser) {
            throw new UnauthorizedException(
                'Credenciais inválidas ou e-mail registrado apenas via ' + (providerOnlyUser?.provider || 'provedor externo') + '.',
            );
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, passwordUser.password!);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Credenciais inválidas.');
        }

        const token = this.jwtService.sign({
            id: passwordUser.id,
            email: passwordUser.email,
            provider: passwordUser.provider
        });

        return { token };
    }

    async setPassword(userId: string, data: SetPasswordDto) {
        const user = await this.userRepository.getUserById(userId);
        if (!user) {
            throw new BadRequestException('Usuário não encontrado.');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);
        await this.userRepository.updatePassword(userId, hashedPassword);

        return { message: 'Senha atualizada com sucesso.' };
    }
}