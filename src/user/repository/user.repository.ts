import { Inject, Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";
import { EmotionalVector } from "src/shared/providers/IA/Ai.service";

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

    async update(userId: string, access_token: string, expires_in: Date) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                spotifyAccessToken: access_token,
                spotifyExpiresAt: expires_in,
            },
        });
    }
    async SaveMood(userId: string, mood: {
        moodScore:number,
        sentiment:string,
        emotions:EmotionalVector,
        tracks:any
    }) {
        await this.prisma.moodAnalysis.create({
            data: {
                userId: userId,
                tracksAnalyzeds:mood.tracks,
                emotions:mood.emotions,
                moodScore:mood.moodScore,
                sentiment:mood.sentiment
            }
        })
    }
}