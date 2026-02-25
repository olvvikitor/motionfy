import { Inject, Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";

@Injectable()
export class UserRepository {
    constructor(@Inject() private prisma: PrismaService) {
    }
    async createNewUser(data: Prisma.UserCreateInput): Promise<void> {
        await this.prisma.user.create({
            data: data
        })
    }
    async getUserByEmail(email: string): Promise<User | null> {
        return await this.prisma.user.findFirst({
            where: {
                email: email
            }
        })
    }
    async getUserById(id: string): Promise<User | null> {
        return await this.prisma.user.findFirst({
            where: {
                id: id
            }
        })
    }
    async update(userId, access_token, expires_in) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                spotifyAccessToken: access_token,
                spotifyExpiresAt: expires_in,
            },
        });
    }
}