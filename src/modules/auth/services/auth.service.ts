import { Inject, Injectable } from "@nestjs/common";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { User } from "@prisma/client";
import { CreateUserService } from "src/modules/user/services/create.user.service";

@Injectable()
export class AuthService {
    constructor(
        @Inject() private provideFactory: MusicProviderFactory,
        @Inject() private createUserService: CreateUserService
    ) { }

    async handleCallback(providerName: string, userData: any) {
        const provider = this.provideFactory.getProvider(providerName);
        const profile = await provider.getProfile(userData.accessToken)

        const user: User = {
            id: profile.id,
            email: profile.email,
            display_name: profile.displayName,
            country: profile.country,
            img_profile: profile.imageUrl ?? '',
            provider: providerName,
            notificateEmail: false,
            notificatePush: false,
            notificateWeek: false,
            accessToken: userData.accessToken,
            refreshToken: userData.refreshToken
        }

        return await this.createUserService.create(user, providerName)
    }
}