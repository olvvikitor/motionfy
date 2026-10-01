// ---------------------------------------------------------------------------
// Página do feed: junta duas fontes (humores e playlists), cada uma já em ordem do mais novo, e decide
// até onde é seguro ir. Função pura.
//
// Cada fonte trouxe no máximo `take` itens antes do cursor. Fonte que veio cheia pode ter mais, abaixo
// do último que trouxe: só os itens a partir desse ponto estão completos (das duas fontes). O cursor
// seguinte é o último item da página ou, sem página cheia, esse ponto.
// ---------------------------------------------------------------------------

export type Timed = { at: Date };

export type SourceBatch<T extends Timed> = {
    items: T[]; // já filtrados (o que não vai ao feed saiu), em ordem do mais novo
    full: boolean; // a consulta trouxe o máximo pedido: pode haver mais
    lastAt: Date | null; // hora do último que a consulta trouxe (antes de filtrar)
};

export function mergeFeedPage<T extends Timed>(sources: SourceBatch<T>[], limit: number): { items: T[]; nextBefore: Date | null } {
    const boundary = sources
        .filter(s => s.full && s.lastAt)
        .reduce<number>((max, s) => Math.max(max, s.lastAt!.getTime()), -Infinity);
    const complete = sources
        .flatMap(s => s.items)
        .filter(item => item.at.getTime() >= boundary)
        .sort((a, b) => b.at.getTime() - a.at.getTime());

    const items = complete.slice(0, limit);
    if (complete.length > limit) return { items, nextBefore: items[items.length - 1].at };
    return { items, nextBefore: Number.isFinite(boundary) ? new Date(boundary) : null };
}
