import { bpmRangeOf, buildFacets, hasFilters, matchesFilters } from './journey-filters';

const rock = { genre: 'Rock', subgenre: 'Indie Rock', bpm: 128 };
const mpb = { genre: 'MPB', subgenre: 'Bossa Nova', bpm: 84 };
const noBpm = { genre: 'Rock', subgenre: 'Grunge', bpm: null };

describe('matchesFilters', () => {
    it('sem filtro, tudo entra', () => {
        expect(hasFilters({})).toBe(false);
        expect(matchesFilters(rock, {})).toBe(true);
    });

    it('gênero e subgênero somam (qualquer um escolhido), sem diferenciar maiúsculas', () => {
        const filters = { genres: ['rock'], subgenres: ['Bossa Nova'] };
        expect(matchesFilters(rock, filters)).toBe(true);
        expect(matchesFilters(mpb, filters)).toBe(true);
        expect(matchesFilters({ genre: 'Pop', subgenre: 'Synthpop', bpm: 110 }, filters)).toBe(false);
    });

    it('subgênero de um gênero escolhido afunila esse gênero', () => {
        const filters = { genres: ['Rock'], subgenres: ['Indie Rock'] };
        expect(matchesFilters(rock, filters)).toBe(true);
        expect(matchesFilters(noBpm, filters)).toBe(false); // Rock, mas Grunge
        expect(matchesFilters(noBpm, { genres: ['Rock'] })).toBe(true);
    });

    it('BPM restringe: precisa estar numa das faixas; sem BPM conhecido fica de fora', () => {
        expect(matchesFilters(rock, { bpm: ['fast'] })).toBe(true);
        expect(matchesFilters(mpb, { bpm: ['fast', 'veryfast'] })).toBe(false);
        expect(matchesFilters(noBpm, { bpm: ['slow'] })).toBe(false);
        expect(matchesFilters(rock, { genres: ['Rock'], bpm: ['slow'] })).toBe(false);
    });

    it('limites das faixas de BPM', () => {
        expect(bpmRangeOf(89)).toBe('slow');
        expect(bpmRangeOf(90)).toBe('medium');
        expect(bpmRangeOf(150)).toBe('veryfast');
        expect(bpmRangeOf(null)).toBeNull();
    });
});

describe('buildFacets', () => {
    it('conta gêneros, subgêneros e faixas de BPM, ignorando Unknown', () => {
        const facets = buildFacets([rock, rock, mpb, noBpm, { genre: 'Unknown', subgenre: 'Unknown', bpm: null }]);
        expect(facets.genres).toEqual([{ name: 'Rock', count: 3 }, { name: 'MPB', count: 1 }]);
        expect(facets.subgenres[0]).toEqual({ name: 'Indie Rock', genre: 'Rock', count: 2 });
        expect(facets.bpm.find(b => b.range === 'fast')?.count).toBe(2);
    });
});
