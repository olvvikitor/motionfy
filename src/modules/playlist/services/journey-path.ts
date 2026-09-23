// ---------------------------------------------------------------------------
// Funções puras da playlist de jornada emocional: traçar o caminho entre dois
// sentimentos no espaço 10D e escolher uma música para cada parada.
// Sem banco, sem rede — tudo aqui é testável isoladamente.
// ---------------------------------------------------------------------------

export type Vector = Record<string, number>;

export interface JourneyCandidate {
    spotifyId: string;
    title: string;
    artist: string;
    imgUrl: string;
    durationMs: number | null;
    vector: Vector;
    dominantSentiment: string;
    fromUserHistory: boolean;
}

export interface JourneyPick {
    candidate: JourneyCandidate;
    stop: number;
    distance: number;
    approximate: boolean;
}

export const DEFAULT_TRACK_MS = 210_000; // 3,5 min, usado quando a faixa não tem duração salva
export const NEAR_RADIUS = 0.6; // mesmo raio (sigma) dos perfis de sentimento
export const MIN_STOPS = 3;
const HISTORY_BONUS = 0.05; // leve preferência por músicas que o usuário já ouve
const DURATION_TOLERANCE_MS = 120_000;
const MAX_STOPS = 40;

export function distance(a: Vector, b: Vector): number {
    let sum = 0;
    for (const key of Object.keys(a)) {
        sum += Math.pow((a[key] ?? 0) - (b[key] ?? 0), 2);
    }
    return Math.sqrt(sum);
}

export function stopCountForDuration(durationMin: number): number {
    return Math.max(MIN_STOPS, Math.round((durationMin * 60_000) / DEFAULT_TRACK_MS));
}

// Linha reta de `from` a `to`, com a primeira parada exatamente em `from` e a última em `to`.
export function buildPath(from: Vector, to: Vector, stops: number): Vector[] {
    const count = Math.max(2, stops);
    return Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        return Object.fromEntries(
            Object.keys(from).map(key => [key, from[key] + (to[key] - from[key]) * t]),
        );
    });
}

// Paradas sem nenhuma candidata dentro do raio.
export function findGaps(path: Vector[], candidates: JourneyCandidate[]): number[] {
    return path
        .map((point, index) => ({ index, nearest: Math.min(Infinity, ...candidates.map(c => distance(point, c.vector))) }))
        .filter(({ nearest }) => nearest > NEAR_RADIUS)
        .map(({ index }) => index);
}

export function trackDuration(candidate: JourneyCandidate): number {
    return candidate.durationMs ?? DEFAULT_TRACK_MS;
}

// Escolhe, em ordem, a candidata mais próxima de cada parada: sem repetir música
// e evitando o mesmo artista em sequência (a menos que não haja outra opção).
export function pickAlongPath(path: Vector[], candidates: JourneyCandidate[]): JourneyPick[] {
    const used = new Set<string>();
    const picks: JourneyPick[] = [];

    path.forEach((point, stop) => {
        const previousArtist = picks[picks.length - 1]?.candidate.artist;
        const ranked = candidates
            .filter(c => !used.has(c.spotifyId))
            .map(c => {
                const d = distance(point, c.vector);
                return { candidate: c, distance: d, score: d - (c.fromUserHistory ? HISTORY_BONUS : 0) };
            })
            .sort((a, b) => a.score - b.score);

        const best = ranked.find(r => r.candidate.artist !== previousArtist) ?? ranked[0];
        if (!best) return;

        used.add(best.candidate.spotifyId);
        picks.push({ candidate: best.candidate, stop, distance: best.distance, approximate: best.distance > NEAR_RADIUS });
    });

    return picks;
}

export function totalDurationMs(picks: JourneyPick[]): number {
    return picks.reduce((sum, p) => sum + trackDuration(p.candidate), 0);
}

// Ajusta o número de paradas até a soma das durações reais ficar perto do alvo.
export function buildJourney(from: Vector, to: Vector, durationMin: number, candidates: JourneyCandidate[]): JourneyPick[] {
    const targetMs = durationMin * 60_000;
    let stops = stopCountForDuration(durationMin);
    let best: JourneyPick[] = [];
    const tried = new Set<number>();

    while (!tried.has(stops) && stops >= MIN_STOPS && stops <= MAX_STOPS) {
        tried.add(stops);
        const picks = pickAlongPath(buildPath(from, to, stops), candidates);
        const diff = totalDurationMs(picks) - targetMs;

        if (!best.length || Math.abs(diff) < Math.abs(totalDurationMs(best) - targetMs)) best = picks;
        if (Math.abs(diff) <= DURATION_TOLERANCE_MS || picks.length < stops) break; // bom o bastante, ou acabaram as músicas

        stops += diff < 0 ? 1 : -1;
    }

    return best;
}
