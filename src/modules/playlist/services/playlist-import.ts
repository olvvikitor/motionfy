// ---------------------------------------------------------------------------
// Playlist do próprio usuário trazida pelo link: funções puras.
// - id da playlist a partir do link (open.spotify.com, com ou sem intl-xx/embed, ou spotify:playlist:)
// - humor da playlist: o rótulo do Jev que mais aparece entre as músicas (como o humor do dashboard,
//   nunca a média reclassificada); empate decidido pelo centro mais perto da média dos vetores
// ---------------------------------------------------------------------------
import { distance, Vector } from "./journey-path";

const PLAYLIST_LINK = /(?:open\.spotify\.com\/(?:[a-z-]+\/)*playlist\/|spotify:playlist:)([A-Za-z0-9]{16,40})/;
const SHARE_DECIMALS = 100;
const TOP_MOODS = 3;

export function parsePlaylistLink(input: string): string | null {
    return PLAYLIST_LINK.exec(input.trim())?.[1] ?? null;
}

export type PlaylistMood = {
    sentiment: string;
    // Os humores que mais aparecem, com a fatia de cada um (0–1) entre as músicas analisadas.
    moods: { sentiment: string; share: number }[];
};

export function playlistMood(tracks: { dominantSentiment: string; vector: Vector }[], clusters: Record<string, Vector>): PlaylistMood | null {
    if (!tracks.length) return null;
    const counts = new Map<string, number>();
    for (const t of tracks) counts.set(t.dominantSentiment, (counts.get(t.dominantSentiment) ?? 0) + 1);

    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const tied = ranked.filter(([, n]) => n === ranked[0][1]).map(([label]) => label);
    const mean = meanVector(tracks.map(t => t.vector));
    const sentiment = tied.length === 1 ? tied[0] : tied.reduce((best, label) => {
        const d = clusters[label] ? distance(mean, clusters[label]) : Infinity;
        const bestD = clusters[best] ? distance(mean, clusters[best]) : Infinity;
        return d < bestD ? label : best;
    });

    const ordered = [sentiment, ...ranked.map(([label]) => label).filter(label => label !== sentiment)];
    return {
        sentiment,
        moods: ordered.slice(0, TOP_MOODS).map(label => ({
            sentiment: label,
            share: Math.round((counts.get(label)! / tracks.length) * SHARE_DECIMALS) / SHARE_DECIMALS,
        })),
    };
}

function meanVector(vectors: Vector[]): Vector {
    const sum: Vector = {};
    for (const v of vectors) for (const [k, n] of Object.entries(v)) sum[k] = (sum[k] ?? 0) + n;
    for (const k of Object.keys(sum)) sum[k] /= vectors.length;
    return sum;
}
