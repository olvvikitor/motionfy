import { Inject, Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";
import { CoreAxes, EmotionalVector } from "src/shared/infra/IA/emotion-analysis.service";

@Injectable()
export class UserRepository {
    constructor(@Inject() private prisma: PrismaService) {}

    async createNewUser(data: Prisma.UserCreateInput): Promise<void> {
        await this.prisma.user.create({ data });
    }

    async getUserByEmail(email: string, provider: string): Promise<User | null> {
        return this.prisma.user.findFirst({ where: { email, provider } });
    }

    async getUserByEmailAuth(email: string): Promise<User | null> {
        return this.prisma.user.findFirst({ where: { email } });
    }

    async updatePassword(userId: string, hashedPw: string): Promise<void> {
        await this.prisma.user.update({ where: { id: userId }, data: { password: hashedPw } });
    }

    async getUserById(id: string): Promise<User | null> {
        return this.prisma.user.findFirst({ where: { id } });
    }

    async update(userId: string, access_token: string) {
        await this.prisma.user.update({ where: { id: userId }, data: { accessToken: access_token } });
    }

    async updateAfterCreate(userId: string, data: { push: boolean; email: boolean; weekly: boolean }) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { notificateEmail: data.email, notificatePush: data.push, notificateWeek: data.weekly },
        });
    }

    async updateFacePhotoPath(userId: string, facePhotoPath: string): Promise<void> {
        await this.prisma.user.update({ where: { id: userId }, data: { face_photo_path: facePhotoPath } });
    }

    async SaveMood(userId: string, mood: {
        moodScore: number;
        sentiment: string;
        image_mood: string;
        emotions: EmotionalVector;
        coreAxes: CoreAxes;
        tracks: any;
    }) {
        await this.prisma.moodAnalysis.create({
            data: {
                userId,
                tracksAnalyzeds: mood.tracks,
                emotions: mood.emotions,
                moodScore: mood.moodScore,
                coreAxes: mood.coreAxes,
                image_mood: mood.image_mood,
                sentiment: mood.sentiment,
            },
        });
    }

    async getMoodUser(userId: string) {
        return this.prisma.moodAnalysis.findFirst({
            where: { userId },
            orderBy: { analyzedAt: "desc" },
        });
    }

    // ─── Histórico de moods ────────────────────────────────────────────────────

    async getMoodHistory(userId: string, limit) {
        return this.prisma.moodAnalysis.findMany({
            where: { userId },
            orderBy: { analyzedAt: "desc" },
            take: limit,
            select: {
                id: true,
                moodScore: true,
                sentiment: true,
                image_mood: true,
                emotions: true,
                coreAxes: true,
                analyzedAt: true,
            },
        });
    }

    // ─── Moods da última semana (7 dias) ──────────────────────────────────────

    async getMoodWeek(userId: string) {
        const since = new Date();
        since.setDate(since.getDate() - 6);
        since.setHours(0, 0, 0, 0);

        return this.prisma.moodAnalysis.findMany({
            where: { userId, analyzedAt: { gte: since } },
            orderBy: { analyzedAt: "asc" },
            select: {
                moodScore: true,
                sentiment: true,
                analyzedAt: true,
            },
        });
    }

    // ─── Estatísticas gerais ──────────────────────────────────────────────────

    async getUserStats(userId: string) {
        // Total de músicas ouvidas
        const totalListened = await this.prisma.listeningHistory.count({ where: { userId } });

        // Top artistas — agrupa por artista no histórico
        const topArtistsRaw = await this.prisma.listeningHistory.findMany({
            where: { userId },
            include: { track: { select: { artist: true, img_url: true } } },
        });

        const artistCount: Record<string, { count: number; img_url: string }> = {};
        for (const entry of topArtistsRaw) {
            const name = entry.track.artist.split(",")[0].trim();
            if (!artistCount[name]) artistCount[name] = { count: 0, img_url: entry.track.img_url ?? "" };
            artistCount[name].count++;
        }

        const topArtists = Object.entries(artistCount)
            .map(([name, data]) => ({ name, count: data.count, img_url: data.img_url }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Top músicas
        const trackCount: Record<string, { count: number; artist: string; img_url: string; title: string }> = {};
        for (const entry of topArtistsRaw) {
            const key = entry.track.artist + "||" + entry.trackId;
            if (!trackCount[key]) {
                trackCount[key] = {
                    count: 0,
                    title: entry.track.artist, // placeholder, será substituído
                    artist: entry.track.artist.split(",")[0].trim(),
                    img_url: entry.track.img_url ?? "",
                };
            }
            trackCount[key].count++;
        }

        // Busca títulos separadamente
        const trackIds = [...new Set(topArtistsRaw.map(e => e.trackId))];
        const tracks = await this.prisma.track.findMany({
            where: { spotifyId: { in: trackIds } },
            select: { spotifyId: true, title: true },
        });
        const titleMap = new Map(tracks.map(t => [t.spotifyId, t.title]));

        const topTracks = Object.entries(trackCount)
            .map(([key, data]) => {
                const spotifyId = key.split("||")[1];
                return { title: titleMap.get(spotifyId) ?? data.artist, artist: data.artist, count: data.count, img_url: data.img_url };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Total de sessões de mood geradas
        const totalMoods = await this.prisma.moodAnalysis.count({ where: { userId } });

        // Média do mood score histórico
        const avgMood = await this.prisma.moodAnalysis.aggregate({
            where: { userId },
            _avg: { moodScore: true },
        });

        return {
            totalListened,
            totalMoods,
            avgMoodScore: avgMood._avg.moodScore ?? 0,
            topArtists,
            topTracks,
        };
    }
}
