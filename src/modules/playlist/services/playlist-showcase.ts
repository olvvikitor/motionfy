// ---------------------------------------------------------------------------
// Destaque do perfil: o que o card de cada playlist mostra. Funções puras.
// - música mais forte: a mais perto do humor da playlist no espaço emocional
// - subgênero: o que mais aparece entre as faixas
// ---------------------------------------------------------------------------
import { EMOTIONAL_DIMENSIONS } from "src/shared/infra/IA/emotion-analysis.service";
import { distance, Vector } from "./journey-path";

export type ShowcaseTrack = { spotifyId: string; title: string; artist: string; imgUrl: string; vector: Vector | null; subgenre: string | null };

export type ShowcaseStats = {
    strongestTrack: { spotifyId: string; title: string; artist: string; imgUrl: string } | null;
    subgenre: string | null;
};

export function showcaseStats(moodVector: Vector | null, tracks: ShowcaseTrack[]): ShowcaseStats {
    const analyzed = moodVector ? tracks.filter((t): t is ShowcaseTrack & { vector: Vector } => Boolean(t.vector)) : [];
    const ranked = analyzed
        .map(t => ({ track: t, d: distance(moodVector!, t.vector) }))
        .sort((a, b) => a.d - b.d);

    const strongest = ranked[0]?.track ?? tracks.find(t => t.imgUrl) ?? null;

    return {
        strongestTrack: strongest && { spotifyId: strongest.spotifyId, title: strongest.title, artist: strongest.artist, imgUrl: strongest.imgUrl },
        subgenre: mostCommon(tracks.map(t => t.subgenre).filter((s): s is string => Boolean(s) && s !== 'Unknown')),
    };
}

export function trackIdsOf(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function toVector(value: unknown): Vector | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const vector: Vector = {};
    for (const dimension of EMOTIONAL_DIMENSIONS) {
        const n = raw[dimension];
        if (typeof n !== 'number' || !Number.isFinite(n)) return null;
        vector[dimension] = n;
    }
    return vector;
}

function mostCommon(values: string[]): string | null {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best: string | null = null;
    let bestCount = 0;
    for (const [v, c] of counts) if (c > bestCount) { best = v; bestCount = c; }
    return best;
}
