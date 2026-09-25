import { normalize, sameSong } from './spotify-catalog.service';

describe('sameSong (Last.fm → Spotify)', () => {
    it('aceita a mesma música com acento, caixa e versão diferentes', () => {
        expect(sameSong({ title: 'Garota de Ipanema', artist: 'Tom Jobim' }, { title: 'Garota De Ipanema - Remastered 2011', artist: 'Tom Jobim' })).toBe(true);
        expect(sameSong({ title: 'Evidências', artist: 'Chitãozinho & Xororó' }, { title: 'Evidencias (Ao Vivo)', artist: 'Chitãozinho & Xororó' })).toBe(true);
    });

    it('aceita quando o artista do Last.fm vem junto com participação', () => {
        expect(sameSong({ title: 'Envolver', artist: 'Anitta' }, { title: 'Envolver', artist: 'Anitta, Outro' })).toBe(true);
        expect(sameSong({ title: 'Song', artist: 'Anitta feat. Outro' }, { title: 'Song', artist: 'Anitta' })).toBe(true);
    });

    it('recusa outra música do mesmo artista', () => {
        expect(sameSong({ title: 'Yesterday', artist: 'The Beatles' }, { title: 'Let It Be', artist: 'The Beatles' })).toBe(false);
    });

    it('recusa a mesma música de outro artista (cover)', () => {
        expect(sameSong({ title: 'Hallelujah', artist: 'Jeff Buckley' }, { title: 'Hallelujah', artist: 'Leonard Cohen' })).toBe(false);
    });

    it('nomes curtos precisam bater exato', () => {
        expect(sameSong({ title: 'One', artist: 'U2' }, { title: 'One', artist: 'U2' })).toBe(true);
        expect(sameSong({ title: 'Go', artist: 'Mo' }, { title: 'Go', artist: 'Moby' })).toBe(false);
    });

    it('normalize tira acento, caixa e pontuação', () => {
        expect(normalize('Ação & Reação!')).toBe('acaoreacao');
    });
});
