import { matchesRequestedGenre, requestQueries } from './request-style';

describe('requestQueries', () => {
    it('pedido que é só o gênero: nenhuma busca de texto (vem do Last.fm)', () => {
        expect(requestQueries('heavy metal', 'Heavy Metal')).toEqual([]);
        expect(requestQueries('MPB', 'MPB')).toEqual([]);
        expect(requestQueries('quero um som de mpb', 'MPB')).toEqual([]);
    });

    it('pedido com mais que o gênero mantém o resto do texto', () => {
        expect(requestQueries('rock nacional do charlie brown', 'Rock Nacional')).toEqual(['do charlie brown']);
    });

    it('sem gênero: o pedido e cada parte dele', () => {
        expect(requestQueries('Racionais', null)).toEqual(['Racionais']);
        expect(requestQueries('Djavan e Caetano', null)).toEqual(['Djavan e Caetano', 'Djavan', 'Caetano']);
    });
});

describe('matchesRequestedGenre', () => {
    it('aceita o subgênero pedido ou outro do mesmo gênero', () => {
        expect(matchesRequestedGenre({ genre: 'Metal', subgenre: 'Heavy Metal' }, 'Heavy Metal')).toBe(true);
        expect(matchesRequestedGenre({ genre: 'Metal', subgenre: 'Metalcore' }, 'Heavy Metal')).toBe(true);
    });

    it('recusa música de outro gênero', () => {
        expect(matchesRequestedGenre({ genre: 'Reggae', subgenre: 'Reggae' }, 'MPB')).toBe(false);
        expect(matchesRequestedGenre({ genre: 'Rock', subgenre: 'Grunge' }, 'Heavy Metal')).toBe(false);
    });

    it('sem gênero pedido, qualquer uma', () => {
        expect(matchesRequestedGenre({ genre: 'Pop', subgenre: 'Pop' }, null)).toBe(true);
    });
});
