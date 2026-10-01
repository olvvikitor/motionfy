import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MofyPlaylistService, ShowcasePlaylist } from 'src/modules/playlist/services/mofy-playlist.service';
import { MOOD_WINDOW_MINUTES, UserService } from 'src/modules/user/services/user.service';
import { FeedRepository, FeedTargetKind, MoodEventRow } from '../repository/feed.repository';
import { FriendshipService } from './friendship.service';
import { mergeFeedPage } from './feed-page';

export const FEED_REACTIONS = ['❤️', '🔥', '😂', '😢'] as const;
export const COMMENT_MAX = 280;
const PAGE_SIZE = 15;
// Humor que durou menos que isso (logo virou outro) não vai ao feed.
const MIN_MOOD_MINUTES = 10;
// Mesmo humor de novo depois de uma pausa menor que isso não é acontecimento novo.
const SAME_MOOD_GAP_MS = 3 * 60 * 60_000;

type Person = { id: string; display_name: string; img_profile: string };

type FeedSocial = {
    reactions: { emoji: string; user: Person }[];
    comments: { id: string; text: string; createdAt: Date; user: Person }[];
};

export type FeedEvent = FeedSocial & { id: string; at: Date; user: Person; mine: boolean } & (
    | {
        kind: 'mood';
        mood: {
            sentiment: string;
            previous: string | null; // humor de antes, quando foi uma troca (não um começo depois de pausa)
            until: Date; // até quando seguiu (o atual vai sendo renovado)
            ongoing: boolean;
            track: { music: string; artist: string; img_url: string } | null; // a mais nova daquele humor
        };
    }
    | { kind: 'playlist'; playlist: ShowcasePlaylist }
);

export type LiveFriend = {
    user: Person;
    track: { id: string; music: string; artist: string; img_url: string; dominantSentiment: string };
};

// Feed: o que você e seus amigos fizeram (playlists criadas e trocas de humor), do mais novo, com reações e
// comentários. "Ouvindo agora" fica à parte (live), porque muda o tempo todo e custa uma consulta ao player por amigo.
@Injectable()
export class FeedService {
    constructor(
        private readonly repository: FeedRepository,
        private readonly friendships: FriendshipService,
        private readonly playlists: MofyPlaylistService,
        private readonly userService: UserService,
    ) { }

    async feed(userId: string, before?: Date, limit = PAGE_SIZE): Promise<{ items: FeedEvent[]; nextBefore: Date | null }> {
        const friendIds = (await this.friendships.getFriends(userId)).map(f => f.id);
        const ids = [userId, ...friendIds];
        const cursor = before ?? new Date();
        // Humores são filtrados depois (troca rápida, mesmo humor repetido): busca mais para a página encher.
        const moodTake = limit * 2;

        const [moodRows, playlistCards, users] = await Promise.all([
            this.repository.moodEvents(ids, cursor, moodTake, MIN_MOOD_MINUTES, MOOD_WINDOW_MINUTES),
            this.playlists.feedCards(ids, cursor, limit),
            this.repository.users(ids),
        ]);
        const userById = new Map(users.map(u => [u.id, u]));

        type Draft = Omit<FeedEvent, keyof FeedSocial | 'user' | 'mine'> & { userId: string };
        const moods: Draft[] = moodRows.filter(isMoodEvent).map(row => ({
            kind: 'mood' as const,
            id: row.id,
            at: row.startedAt,
            userId: row.userId,
            mood: {
                sentiment: row.sentiment,
                previous: isChange(row) ? row.prevSentiment : null,
                until: row.analyzedAt,
                ongoing: row.isLatest && Date.now() - row.analyzedAt.getTime() < MOOD_WINDOW_MINUTES * 60_000,
                track: row.topTrack?.music ? { music: row.topTrack.music, artist: row.topTrack.artist ?? '', img_url: row.topTrack.img_url ?? '' } : null,
            },
        }));
        const playlists: Draft[] = playlistCards.map(({ userId: owner, ...playlist }) => ({
            kind: 'playlist' as const,
            id: playlist.id,
            at: playlist.createdAt,
            userId: owner,
            playlist,
        }));

        const page = mergeFeedPage([
            { items: moods, full: moodRows.length === moodTake, lastAt: moodRows.at(-1)?.startedAt ?? null },
            { items: playlists, full: playlistCards.length === limit, lastAt: playlistCards.at(-1)?.createdAt ?? null },
        ], limit);

        const social = await this.social(page.items);
        const items = page.items.flatMap(({ userId: owner, ...event }) => {
            const user = userById.get(owner);
            if (!user) return [];
            const key = `${event.kind}:${event.id}`;
            return [{ ...event, user, mine: owner === userId, ...(social.get(key) ?? { reactions: [], comments: [] }) } as FeedEvent];
        });
        return { items, nextBefore: page.nextBefore };
    }

    // Amigos tocando algo agora (um por amigo; falha de um não derruba os outros).
    async live(userId: string): Promise<LiveFriend[]> {
        const friends = await this.friendships.getFriends(userId);
        const results = await Promise.allSettled(friends.map(f => this.userService.listeningNow(f.id)));
        return friends.flatMap((friend, i) => {
            const result = results[i];
            if (result.status !== 'fulfilled' || !result.value.isPlaying || !('tracks' in result.value)) return [];
            const track = result.value.tracks?.[0];
            if (!track) return [];
            return [{
                user: { id: friend.id, display_name: friend.display_name, img_profile: friend.img_profile },
                track: { id: track.id, music: track.music, artist: track.artist, img_url: track.img_url, dominantSentiment: track.dominantSentiment },
            }];
        });
    }

    async toggleReaction(userId: string, kind: FeedTargetKind, targetId: string, emoji: string) {
        if (!(FEED_REACTIONS as readonly string[]).includes(emoji)) throw new BadRequestException('Reação inválida.');
        await this.assertCanInteract(userId, kind, targetId);
        const existing = await this.repository.findReaction(kind, targetId, userId);
        if (!existing) {
            await this.repository.createReaction(kind, targetId, userId, emoji);
            return { action: 'added', emoji };
        }
        if (existing.emoji === emoji) {
            await this.repository.deleteReaction(kind, existing.id);
            return { action: 'removed' };
        }
        await this.repository.updateReaction(kind, existing.id, emoji);
        return { action: 'updated', emoji };
    }

    async addComment(userId: string, kind: FeedTargetKind, targetId: string, text: string) {
        const clean = text.replace(/\s+/g, ' ').trim();
        if (!clean || clean.length > COMMENT_MAX) throw new BadRequestException(`O comentário precisa ter de 1 a ${COMMENT_MAX} letras.`);
        await this.assertCanInteract(userId, kind, targetId);
        return this.repository.createComment(kind, targetId, userId, clean);
    }

    // Só o dono e os amigos dele reagem e comentam.
    private async assertCanInteract(userId: string, kind: FeedTargetKind, targetId: string) {
        const owner = await this.repository.ownerOf(kind, targetId);
        if (!owner) throw new NotFoundException('Não encontrado.');
        if (owner !== userId && !(await this.friendships.areFriends(userId, owner))) throw new ForbiddenException('Vocês não são amigos.');
    }

    private async social(items: { kind: FeedTargetKind; id: string }[]): Promise<Map<string, FeedSocial>> {
        const idsOf = (kind: FeedTargetKind) => items.filter(i => i.kind === kind).map(i => i.id);
        const [moodReactions, moodComments, playlistReactions, playlistComments] = await Promise.all([
            this.repository.reactions('mood', idsOf('mood')),
            this.repository.comments('mood', idsOf('mood')),
            this.repository.reactions('playlist', idsOf('playlist')),
            this.repository.comments('playlist', idsOf('playlist')),
        ]);
        const map = new Map<string, FeedSocial>();
        const slot = (key: string) => {
            if (!map.has(key)) map.set(key, { reactions: [], comments: [] });
            return map.get(key)!;
        };
        for (const { targetId, ...r } of moodReactions) slot(`mood:${targetId}`).reactions.push(r);
        for (const { targetId, ...c } of moodComments) slot(`mood:${targetId}`).comments.push(c);
        for (const { targetId, ...r } of playlistReactions) slot(`playlist:${targetId}`).reactions.push(r);
        for (const { targetId, ...c } of playlistComments) slot(`playlist:${targetId}`).comments.push(c);
        return map;
    }
}

// Troca de humor (não um começo depois de uma pausa longa): o anterior acabou há pouco e era outro.
function isChange(row: MoodEventRow): boolean {
    return Boolean(row.prevSentiment && row.prevEnd && row.prevSentiment !== row.sentiment
        && row.startedAt.getTime() - row.prevEnd.getTime() < SAME_MOOD_GAP_MS);
}

// Mesmo humor de novo logo depois de uma pausa curta não é acontecimento: é o mesmo, continuado.
function isMoodEvent(row: MoodEventRow): boolean {
    if (!row.prevSentiment || row.prevSentiment !== row.sentiment || !row.prevEnd) return true;
    return row.startedAt.getTime() - row.prevEnd.getTime() >= SAME_MOOD_GAP_MS;
}
