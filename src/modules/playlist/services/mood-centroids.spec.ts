import { learnCentroids, PRIOR_WEIGHT } from './mood-centroids';

describe('learnCentroids', () => {
    const prior = { Amor: { a: 1, b: 1 }, Paz: { a: 0, b: 0 } };

    it('com muitas músicas, o centro vai para a mediana delas', () => {
        const rows = Array.from({ length: 1000 }, () => ({ vector: { a: 0.4, b: 0.6 }, sentiment: 'Amor' }));
        const { Amor } = learnCentroids(rows, prior);
        expect(Amor.a).toBeCloseTo(0.4, 1);
        expect(Amor.b).toBeCloseTo(0.6, 1);
    });

    it('com poucas, fica entre o perfil e a mediana; sem nenhuma, é o perfil', () => {
        const rows = Array.from({ length: PRIOR_WEIGHT }, () => ({ vector: { a: 0, b: 0 }, sentiment: 'Amor' }));
        const learned = learnCentroids(rows, prior);
        expect(learned.Amor.a).toBeCloseTo(0.5);
        expect(learned.Paz).toEqual(prior.Paz);
    });

    it('usa a mediana: um valor fora da curva não arrasta o centro', () => {
        const rows = [0.5, 0.5, 0.5, 0.5, 9].map(a => ({ vector: { a, b: 0 }, sentiment: 'Paz' }));
        expect(learnCentroids(rows, { Paz: { a: 0.5, b: 0 } }).Paz.a).toBeCloseTo(0.5);
    });
});
