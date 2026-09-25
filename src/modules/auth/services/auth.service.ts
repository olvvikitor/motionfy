import { Inject, Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { User } from "@prisma/client";
import { CreateUserService } from "src/modules/user/services/create.user.service";
import { UserRepository } from "src/modules/user/repository/user.repository";
import { JwtService } from "@nestjs/jwt";
import { LoginCredentialsDto, SetPasswordDto } from "../dtos/auth.dto";
import * as bcrypt from 'bcrypt';
import { lastFmUserId } from 'src/shared/infra/music/lastfm/lastfm.service';

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
            image_credits: 1,
            provider: providerName,
            notificateEmail: false,
            notificatePush: false,
            notificateWeek: false,
            accessToken: userData.accessToken,
            refreshToken: userData.refreshToken
        }

        // Contas novas só pelo Last.fm; quem já tinha conta pelo Spotify continua entrando.
        return await this.createUserService.create(user, providerName, { allowNew: providerName === 'lastfm' });
    }

    // Contas novas entram com o usuário do Last.fm; contas antigas do Spotify, com o e-mail.
    async login(credentials: LoginCredentialsDto) {
        const login = credentials.login.trim();
        const users = login.includes('@')
            ? await this.userRepository.getUsersByEmail(login)
            : [await this.userRepository.getUserById(lastFmUserId(login))].filter((u): u is User => Boolean(u));
        const passwordUser = users.find(user => Boolean(user.password));

        if (!passwordUser) {
            throw new UnauthorizedException(users.length
                ? 'Essa conta ainda não tem senha. Entre com o Last.fm.'
                : 'Usuário ou senha incorretos.');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, passwordUser.password!);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Usuário ou senha incorretos.');
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