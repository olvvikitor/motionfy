import { Injectable } from "@nestjs/common";
import { MusicProviderFactory } from "src/shared/infra/music/music.provider.factory";
import { CreateUserService } from "../services/create.user.service";
import { User } from "@prisma/client";

@Injectable()
export class AuthService {
    constructor(
        private provideFactory: MusicProviderFactory,
        private createUserService: CreateUserService
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
            accessToken: userData.accessToken,
            refreshToken: userData.refreshToken
        }
        await this.createUserService.create(user)
    }
}