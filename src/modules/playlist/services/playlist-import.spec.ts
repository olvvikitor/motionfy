import { parsePlaylistLink, playlistMood } from "./playlist-import";

describe('parsePlaylistLink', () => {
    it('lê o id dos formatos de link do Spotify', () => {
        expect(parsePlaylistLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123')).toBe('37i9dQZF1DXcBWIGoYBM5M');
        expect(parsePlaylistLink('  open.spotify.com/intl-pt/playlist/37i9dQZF1DXcBWIGoYBM5M ')).toBe('37i9dQZF1DXcBWIGoYBM5M');
        expect(parsePlaylistLink('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('37i9dQZF1DXcBWIGoYBM5M');
        expect(parsePlaylistLink('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('recusa o que não é playlist', () => {
        expect(parsePlaylistLink('https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M')).toBeNull();
        expect(parsePlaylistLink('minha playlist')).toBeNull();
    });
});

describe('playlistMood', () => {
    const clusters = { Alegria: { a: 1, b: 0 }, Calma: { a: 0, b: 1 } };

    it('fica com o humor que mais aparece e dá a fatia de cada um', () => {
        const mood = playlistMood([
            { dominantSentiment: 'Calma', vector: { a: 0, b: 1 } },
            { dominantSentiment: 'Alegria', vector: { a: 1, b: 0 } },
            { dominantSentiment: 'Calma', vector: { a: 0, b: 1 } },
            { dominantSentiment: 'Calma', vector: { a: 0.2, b: 0.8 } },
        ], clusters);
        expect(mood).toEqual({ sentiment: 'Calma', moods: [{ sentiment: 'Calma', share: 0.75 }, { sentiment: 'Alegria', share: 0.25 }] });
    });

    it('no empate, vale o centro mais perto da média', () => {
        const mood = playlistMood([
            { dominantSentiment: 'Calma', vector: { a: 0.9, b: 0.3 } },
            { dominantSentiment: 'Alegria', vector: { a: 1, b: 0 } },
        ], clusters);
        expect(mood?.sentiment).toBe('Alegria');
    });

    it('sem músicas analisadas, sem humor', () => {
        expect(playlistMood([], clusters)).toBeNull();
    });
});
