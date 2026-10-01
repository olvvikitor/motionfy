import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/config/prisma.service';

export type FeedTargetKind = 'mood' | 'playlist';

// Humor no feed, já com o anterior da mesma pessoa (para "foi de X para Y").
export type MoodEventRow = {
    id: string;
    userId: string;
    sentiment: string;
    startedAt: Date;
    analyzedAt: Date;
    prevSentiment: string | null;
    prevEnd: Date | null;
    isLatest: boolean;
    topTrack: { music?: string; artist?: string; img_url?: string } | null;
};

const PERSON = { select: { id: true, display_name: true, img_profile: true } } as const;

@Injectable()
export class FeedRepository {
    constructor(private readonly prisma: PrismaService) { }

    // Humores destes usuários que começaram antes de `before`, dos mais novos. Humor de poucos minutos (que logo
    // virou outro) não entra nem conta como "anterior": senão o feed vira uma linha por música. O atual sempre entra.
    async moodEvents(userIds: string[], before: Date, take: number, minMinutes: number, windowMinutes: number): Promise<MoodEventRow[]> {
        if (!userIds.length) return [];
        return this.prisma.$queryRaw<MoodEventRow[]>`
            WITH kept AS (
                SELECT m."id", m."userId", m."sentiment", m."startedAt", m."analyzedAt",
                       CASE WHEN jsonb_typeof(m."tracksAnalyzeds"::jsonb) = 'array' THEN m."tracksAnalyzeds"::jsonb -> 0 END AS "topTrack"
                FROM "MoodAnalysis" m
                WHERE m."userId" IN (${Prisma.join(userIds)})
                  AND (m."analyzedAt" - m."startedAt" >= make_interval(mins => ${minMinutes})
                       OR m."analyzedAt" > now() - make_interval(mins => ${windowMinutes}))
            ), seq AS (
                SELECT k.*,
                       LAG(k."sentiment") OVER w AS "prevSentiment",
                       LAG(k."analyzedAt") OVER w AS "prevEnd",
                       LEAD(k."id") OVER w IS NULL AS "isLatest"
                FROM kept k
                WINDOW w AS (PARTITION BY k."userId" ORDER BY k."startedAt")
            )
            SELECT * FROM seq WHERE "startedAt" < ${before}
            ORDER BY "startedAt" DESC
            LIMIT ${take}`;
    }

    async users(ids: string[]) {
        return this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, display_name: true, img_profile: true } });
    }

    async reactions(kind: FeedTargetKind, ids: string[]) {
        if (!ids.length) return [];
        if (kind === 'mood') {
            const rows = await this.prisma.moodReaction.findMany({ where: { moodAnalysisId: { in: ids } }, select: { moodAnalysisId: true, emoji: true, user: PERSON }, orderBy: { createdAt: 'asc' } });
            return rows.map(({ moodAnalysisId, ...r }) => ({ targetId: moodAnalysisId, ...r }));
        }
        const rows = await this.prisma.playlistReaction.findMany({ where: { mofyPlaylistId: { in: ids } }, select: { mofyPlaylistId: true, emoji: true, user: PERSON }, orderBy: { createdAt: 'asc' } });
        return rows.map(({ mofyPlaylistId, ...r }) => ({ targetId: mofyPlaylistId, ...r }));
    }

    async comments(kind: FeedTargetKind, ids: string[]) {
        if (!ids.length) return [];
        const select = { id: true, text: true, createdAt: true, user: PERSON } as const;
        if (kind === 'mood') {
            const rows = await this.prisma.moodComment.findMany({ where: { moodAnalysisId: { in: ids } }, select: { ...select, moodAnalysisId: true }, orderBy: { createdAt: 'asc' } });
            return rows.map(({ moodAnalysisId, ...c }) => ({ targetId: moodAnalysisId, ...c }));
        }
        const rows = await this.prisma.playlistComment.findMany({ where: { mofyPlaylistId: { in: ids } }, select: { ...select, mofyPlaylistId: true }, orderBy: { createdAt: 'asc' } });
        return rows.map(({ mofyPlaylistId, ...c }) => ({ targetId: mofyPlaylistId, ...c }));
    }

    // Dono do humor/playlist (para conferir se quem reage é amigo dele). null = não existe.
    async ownerOf(kind: FeedTargetKind, id: string): Promise<string | null> {
        const row = kind === 'mood'
            ? await this.prisma.moodAnalysis.findUnique({ where: { id }, select: { userId: true } })
            : await this.prisma.mofyPlaylist.findUnique({ where: { id }, select: { userId: true } });
        return row?.userId ?? null;
    }

    async findReaction(kind: FeedTargetKind, targetId: string, userId: string) {
        return kind === 'mood'
            ? this.prisma.moodReaction.findUnique({ where: { moodAnalysisId_userId: { moodAnalysisId: targetId, userId } }, select: { id: true, emoji: true } })
            : this.prisma.playlistReaction.findUnique({ where: { mofyPlaylistId_userId: { mofyPlaylistId: targetId, userId } }, select: { id: true, emoji: true } });
    }

    async createReaction(kind: FeedTargetKind, targetId: string, userId: string, emoji: string): Promise<void> {
        if (kind === 'mood') await this.prisma.moodReaction.create({ data: { moodAnalysisId: targetId, userId, emoji } });
        else await this.prisma.playlistReaction.create({ data: { mofyPlaylistId: targetId, userId, emoji } });
    }

    async updateReaction(kind: FeedTargetKind, id: string, emoji: string): Promise<void> {
        if (kind === 'mood') await this.prisma.moodReaction.update({ where: { id }, data: { emoji } });
        else await this.prisma.playlistReaction.update({ where: { id }, data: { emoji } });
    }

    async deleteReaction(kind: FeedTargetKind, id: string): Promise<void> {
        if (kind === 'mood') await this.prisma.moodReaction.delete({ where: { id } });
        else await this.prisma.playlistReaction.delete({ where: { id } });
    }

    async createComment(kind: FeedTargetKind, targetId: string, userId: string, text: string) {
        const select = { id: true, text: true, createdAt: true, user: PERSON } as const;
        return kind === 'mood'
            ? this.prisma.moodComment.create({ data: { moodAnalysisId: targetId, userId, text }, select })
            : this.prisma.playlistComment.create({ data: { mofyPlaylistId: targetId, userId, text }, select });
    }
}
