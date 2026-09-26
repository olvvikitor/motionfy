// ---------------------------------------------------------------------------
// Destaque do perfil: o que o card de cada playlist mostra. Funções puras.
// - música mais forte: a mais perto do humor da playlist no espaço emocional
// - score: quanto da playlist está de fato nesse humor (% das faixas no raio)
// - subgênero: o que mais aparece entre as faixas
// ---------------------------------------------------------------------------
import { distance, Vector } from "./journey-path";

// Raio largo do card do perfil (% das faixas no humor da playlist); a escolha usa FIT_RADIUS.
const NEAR_RADIUS = 0.6;

export type ShowcaseTrack = { spotifyId: string; title: string; artist: string; imgUrl: string; vector: Vector | null; subgenre: string | null };

export type ShowcaseStats = {
    strongestTrack: { spotifyId: string; title: string; artist: string; imgUrl: string } | null;
    score: number | null; // 0 a 100; null sem faixas analisadas
    subgenre: string | null;
};

export function showcaseStats(moodVector: Vector | null, tracks: ShowcaseTrack[]): ShowcaseStats {
    const analyzed = moodVector ? tracks.filter((t): t is ShowcaseTrack & { vector: Vector } => Boolean(t.vector)) : [];
    const ranked = analyzed
        .map(t => ({ track: t, d: distance(moodVector!, t.vector) }))
        .sort((a, b) => a.d - b.d);

    const strongest = ranked[0]?.track ?? tracks.find(t => t.imgUrl) ?? null;
    const score = ranked.length ? Math.round(100 * ranked.filter(r => r.d <= NEAR_RADIUS).length / ranked.length) : null;

    return {
        strongestTrack: strongest && { spotifyId: strongest.spotifyId, title: strongest.title, artist: strongest.artist, imgUrl: strongest.imgUrl },
        score,
        subgenre: mostCommon(tracks.map(t => t.subgenre).filter((s): s is string => Boolean(s) && s !== 'Unknown')),
    };
}

function mostCommon(values: string[]): string | null {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best: string | null = null;
    let bestCount = 0;
    for (const [v, c] of counts) if (c > bestCount) { best = v; bestCount = c; }
    return best;
}

// Sem escolha do usuário: as mais novas, uma por humor, até `limit`.
export function defaultFeatured<T extends { sentiment: string | null }>(newestFirst: T[], limit = 5): T[] {
    const seen = new Set<string>();
    const picked: T[] = [];
    for (const p of newestFirst) {
        const key = p.sentiment ?? '';
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(p);
        if (picked.length >= limit) break;
    }
    return picked;
}
