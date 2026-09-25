import { defaultFeatured, showcaseStats, ShowcaseTrack } from './playlist-showcase';

const MOOD = { a: 0, b: 1 };
const track = (id: string, vector: Record<string, number> | null, subgenre: string | null = null): ShowcaseTrack =>
    ({ spotifyId: id, title: `Song ${id}`, artist: `Artist ${id}`, imgUrl: `img-${id}`, vector, subgenre });

describe('showcaseStats', () => {
    it('música mais forte é a mais perto do humor da playlist', () => {
        const stats = showcaseStats(MOOD, [track('far', { a: 1, b: 0 }), track('close', { a: 0.05, b: 0.95 }), track('mid', { a: 0.3, b: 0.7 })]);
        expect(stats.strongestTrack?.spotifyId).toBe('close');
    });

    it('score = % das faixas dentro do raio do humor', () => {
        const stats = showcaseStats(MOOD, [track('1', { a: 0, b: 1 }), track('2', { a: 0.1, b: 0.9 }), track('3', { a: 3, b: -3 }), track('4', { a: 4, b: -4 })]);
        expect(stats.score).toBe(50);
    });

    it('subgênero mais comum, ignorando Unknown', () => {
        const stats = showcaseStats(MOOD, [track('1', null, 'Unknown'), track('2', null, 'MPB'), track('3', null, 'MPB'), track('4', null, 'Rock')]);
        expect(stats.subgenre).toBe('MPB');
    });

    it('sem análises: sem score e usa a primeira faixa com capa', () => {
        const stats = showcaseStats(MOOD, [track('1', null)]);
        expect(stats.score).toBeNull();
        expect(stats.strongestTrack?.spotifyId).toBe('1');
    });
});

describe('defaultFeatured', () => {
    it('pega as mais novas, uma por humor, até o limite', () => {
        const list = [{ id: 1, sentiment: 'Paz' }, { id: 2, sentiment: 'Paz' }, { id: 3, sentiment: 'Tensao' }, { id: 4, sentiment: 'Amor' }];
        expect(defaultFeatured(list, 2).map(p => p.id)).toEqual([1, 3]);
    });
});
