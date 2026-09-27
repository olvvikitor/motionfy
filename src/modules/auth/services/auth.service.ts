import { Inject, Injectable, ConflictException } from "@nestjs/common";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { Prisma, User } from "@prisma/client";
import { CreateUserService } from "src/modules/user/services/create.user.service";
import { UserRepository } from "src/modules/user/repository/user.repository";
import { SetEmailDto } from "../dtos/auth.dto";

@Injectable()
export class AuthService {
    constructor(
        @Inject() private provideFactory: MusicProviderFactory,
        @Inject() private createUserService: CreateUserService,
        @Inject() private userRepository: UserRepository
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
            image_credits: new Prisma.Decimal(1),
            provider: providerName,
            notificateEmail: false,
            notificatePush: false,
            notificateWeek: false,
            accessToken: userData.accessToken,
            refreshToken: userData.refreshToken
        }

        // Contas novas só pelo Last.fm (não há mais login pelo Spotify; contas antigas entram com e-mail e senha).
        return await this.createUserService.create(user, providerName, { allowNew: providerName === 'lastfm' });
    }

    // E-mail em minúsculas, um por conta (cada e-mail identifica uma pessoa só nas notificações).
    async setEmail(userId: string, data: SetEmailDto) {
        const email = data.email.trim().toLowerCase();
        if (await this.userRepository.isEmailTakenByOther(email, userId)) {
            throw new ConflictException('Esse e-mail já está em outra conta.');
        }
        await this.userRepository.updateEmail(userId, email);
        return { email };
    }
}