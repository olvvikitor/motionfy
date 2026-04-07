import { Inject, Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";
import { CoreAxes, EmotionalVector } from "src/shared/infra/IA/emotion-analysis.service";

@Injectable()
export class UserRepository {
    constructor(@Inject() private prisma: PrismaService) { }

    async createNewUser(data: Prisma.UserCreateInput): Promise<void> {
        await this.prisma.user.create({ data });
    }

    async getUserByEmail(email: string, provider: string): Promise<User | null> {
        return this.prisma.user.findFirst({ where: { email, provider } });
    }

    async getUserByEmailAuth(email: string): Promise<User | null> {
        return this.prisma.user.findFirst({ where: { email } });
    }

    async getUsersByEmail(email: string): Promise<User[]> {
        return this.prisma.user.findMany({ where: { email } });
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

    async updateStudioPreference(userId: string, studioId: string): Promise<void> {
        await this.prisma.user.update({ where: { id: userId }, data: { preferredStudioId: studioId } });
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
            select: {
                id: true,
                moodScore: true,
                sentiment: true,
                image_mood: true,
                emotions: true,
                coreAxes: true,
                analyzedAt: true,
                tracksAnalyzeds: true,
            },
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

    // ─── Insights detalhados ──────────────────────────────────────────────────

    async getUserInsights(userId: string) {
        // ── Mood data ──
        const allMoods = await this.prisma.moodAnalysis.findMany({
            where: { userId },
            orderBy: { analyzedAt: "desc" },
            select: { moodScore: true, sentiment: true, analyzedAt: true, emotions: true },
        });

        // ── Listening data ──
        const allHistory = await this.prisma.listeningHistory.findMany({
            where: { userId },
            select: { playedAt: true, trackId: true },
        });

        // ── 1. Mood Streak (consecutive days with mood, counting back from today) ──
        let moodStreak = 0;
        if (allMoods.length > 0) {
            const moodDays = new Set(
                allMoods.map(m => {
                    const d = new Date(m.analyzedAt);
                    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                }),
            );
            const today = new Date();
            for (let i = 0; i < 365; i++) {
                const check = new Date(today);
                check.setDate(check.getDate() - i);
                const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
                if (moodDays.has(key)) {
                    moodStreak++;
                } else {
                    break;
                }
            }
        }

        // ── 2. Dominant mood of the month ──
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const monthMoods = allMoods.filter(m => new Date(m.analyzedAt) >= thirtyDaysAgo);
        const sentimentCount: Record<string, number> = {};
        for (const m of monthMoods) {
            sentimentCount[m.sentiment] = (sentimentCount[m.sentiment] ?? 0) + 1;
        }
        const dominantMoodMonth = Object.entries(sentimentCount)
            .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        // ── 3. Volatility (std dev of moodScore) ──
        let volatility = 0;
        let volatilityLabel = "estável";
        if (allMoods.length >= 2) {
            const scores = allMoods.map(m => m.moodScore);
            const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
            const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
            volatility = Math.round(Math.sqrt(variance) * 100);
            if (volatility > 25) volatilityLabel = "muito volátil";
            else if (volatility > 15) volatilityLabel = "volátil";
            else if (volatility > 8) volatilityLabel = "moderado";
            else volatilityLabel = "consistente";
        }

        // ── 4. Best / worst day of week ──
        const dayScores: Record<number, { total: number; count: number }> = {};
        for (const m of allMoods) {
            const day = new Date(m.analyzedAt).getDay();
            if (!dayScores[day]) dayScores[day] = { total: 0, count: 0 };
            dayScores[day].total += m.moodScore;
            dayScores[day].count++;
        }
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const dayAvgs = Object.entries(dayScores).map(([d, v]) => ({
            day: dayNames[Number(d)],
            avg: v.total / v.count,
        }));
        dayAvgs.sort((a, b) => b.avg - a.avg);
        const bestDay = dayAvgs[0]?.day ?? null;
        const worstDay = dayAvgs[dayAvgs.length - 1]?.day ?? null;

        // ── 5. Peak listening hour ──
        const hourCount: Record<number, number> = {};
        for (const h of allHistory) {
            const hour = new Date(h.playedAt).getHours();
            hourCount[hour] = (hourCount[hour] ?? 0) + 1;
        }
        const peakHour = Object.entries(hourCount)
            .sort((a, b) => b[1] - a[1])[0]
            ? Number(Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0][0])
            : null;

        // ── 6. Listener type ──
        const uniqueArtists = new Set<string>();
        const artistHistoryRaw = await this.prisma.listeningHistory.findMany({
            where: { userId },
            include: { track: { select: { artist: true } } },
        });
        for (const entry of artistHistoryRaw) {
            uniqueArtists.add(entry.track.artist.split(",")[0].trim());
        }
        const totalTracks = artistHistoryRaw.length;
        const uniqueCount = uniqueArtists.size;
        const ratio = totalTracks > 0 ? uniqueCount / totalTracks : 0;
        const listenerType = ratio > 0.4 ? "explorador" : "fiel";

        // ── 7. Night listener check ──
        let nightListens = 0;
        for (const h of allHistory) {
            const hour = new Date(h.playedAt).getHours();
            if (hour >= 0 && hour < 5) nightListens++;
        }
        const isNightListener = nightListens > 10;

        // ── 8. Badges ──
        const badges: { id: string; label: string; description: string; earned: boolean }[] = [
            {
                id: "streak_7",
                label: "Consistente",
                description: "7 dias seguidos com mood registrado",
                earned: moodStreak >= 7,
            },
            {
                id: "streak_30",
                label: "Dedicado",
                description: "30 dias seguidos com mood registrado",
                earned: moodStreak >= 30,
            },
            {
                id: "night_owl",
                label: "Ouvinte Noturno",
                description: "Ouve música após a meia-noite",
                earned: isNightListener,
            },
            {
                id: "explorer",
                label: "Explorador",
                description: "10+ artistas diferentes no mês",
                earned: uniqueCount >= 10,
            },
            {
                id: "loyal",
                label: "Fiel ao Estilo",
                description: "Mantém o mesmo estilo por 30 dias",
                earned: listenerType === "fiel" && totalTracks >= 30,
            },
            {
                id: "first_mood",
                label: "Primeiro Mood",
                description: "Registrou seu primeiro mood",
                earned: allMoods.length >= 1,
            },
        ];

        // ── 9. Listening time distribution ──
        const periodCount = { manha: 0, tarde: 0, noite: 0, madrugada: 0 };
        for (const h of allHistory) {
            const hour = new Date(h.playedAt).getHours();
            if (hour >= 5 && hour < 12) periodCount.manha++;
            else if (hour >= 12 && hour < 18) periodCount.tarde++;
            else if (hour >= 18 && hour < 24) periodCount.noite++;
            else periodCount.madrugada++;
        }

        return {
            moodStreak,
            dominantMoodMonth,
            volatility,
            volatilityLabel,
            bestDay,
            worstDay,
            peakHour,
            listenerType,
            uniqueArtists: uniqueCount,
            totalTracksListened: totalTracks,
            badges,
            listeningPeriods: periodCount,
            totalMoods: allMoods.length,
        };
    }
}
