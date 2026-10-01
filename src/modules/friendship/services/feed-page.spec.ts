import { mergeFeedPage } from './feed-page';

const at = (minute: number) => ({ at: new Date(Date.UTC(2026, 9, 1, 12, minute)), id: `m${minute}` });

describe('mergeFeedPage', () => {
    it('intercala as fontes do mais novo para o mais velho', () => {
        const page = mergeFeedPage([
            { items: [at(50), at(30)], full: false, lastAt: at(30).at },
            { items: [at(40), at(10)], full: false, lastAt: at(10).at },
        ], 10);
        expect(page.items.map(i => i.id)).toEqual(['m50', 'm40', 'm30', 'm10']);
        expect(page.nextBefore).toBeNull();
    });

    it('não passa do último item de uma fonte cheia (abaixo dele ela pode ter mais)', () => {
        const page = mergeFeedPage([
            { items: [at(50), at(30)], full: true, lastAt: at(30).at },
            { items: [at(40), at(10)], full: false, lastAt: at(10).at },
        ], 10);
        expect(page.items.map(i => i.id)).toEqual(['m50', 'm40', 'm30']);
        expect(page.nextBefore).toEqual(at(30).at);
    });

    it('com mais itens que o limite, o cursor é o último da página', () => {
        const page = mergeFeedPage([
            { items: [at(50), at(40), at(30)], full: false, lastAt: at(30).at },
        ], 2);
        expect(page.items.map(i => i.id)).toEqual(['m50', 'm40']);
        expect(page.nextBefore).toEqual(at(40).at);
    });

    it('fonte cheia com tudo filtrado ainda devolve cursor para seguir', () => {
        const page = mergeFeedPage([
            { items: [], full: true, lastAt: at(20).at },
            { items: [at(10)], full: false, lastAt: at(10).at },
        ], 10);
        expect(page.items).toEqual([]);
        expect(page.nextBefore).toEqual(at(20).at);
    });
});
