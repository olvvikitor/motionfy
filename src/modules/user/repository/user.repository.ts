import { Inject, Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";
import { CoreAxes, EmotionalVector } from "src/shared/infra/IA/emotion-analysis.service";

@Injectable()
export class UserRepository {
    constructor(@Inject() private prisma: PrismaService) {
    }
    async createNewUser(data: Prisma.UserCreateInput): Promise<void> {
        await this.prisma.user.create({
            data: data
        })
    }

    async getUserByEmail(email: string, provider: string): Promise<User | null> {
        return await this.prisma.user.findFirst({
            where: {
                email: email,
                provider: provider
            }
        })
    }

    // Busca usuário independente de provedor para a autenticação baseada em E-mail.
    async getUserByEmailAuth(email: string): Promise<User | null> {
        return await this.prisma.user.findFirst({
            where: {
                email: email
            }
        })
    }

    async updatePassword(userId: string, hashedPw: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPw }
        })
    }

    async getUserById(id: string): Promise<User | null> {
        return await this.prisma.user.findFirst({
            where: {
                id: id
            }
        })
    }

    async update(userId: string, access_token: string
    ) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                accessToken: access_token,
            },
        });
    }
    async updateAfterCreate(userId: string, data: {
        push: boolean
        email: boolean
        weekly: boolean
    }) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                notificateEmail: data.email,
                notificatePush: data.push,
                notificateWeek: data.weekly,
            },
        });
    }

    async updateFacePhotoPath(userId: string, facePhotoPath: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                face_photo_path: facePhotoPath,
            },
        });
    }

    async SaveMood(userId: string, mood: {
        moodScore: number,
        sentiment: string,
        image_mood: string,
        emotions: EmotionalVector,
        coreAxes: CoreAxes
        tracks: any
    }) {
        await this.prisma.moodAnalysis.create({
            data: {
                userId: userId,
                tracksAnalyzeds: mood.tracks,
                emotions: mood.emotions,
                moodScore: mood.moodScore,
                coreAxes: mood.coreAxes,
                image_mood: mood.image_mood,
                sentiment: mood.sentiment
            }
        })
    }
    async getMoodUser(userId: string) {
        return await this.prisma.moodAnalysis.findFirst({
            where: {
                userId: userId
            },
            orderBy: {
                analyzedAt: "desc"
            }

        })
    }
}