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
    fromUserHistory: boolean; // ouvida ou curtida pelo usuário
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
// Preferência clara pelas músicas do usuário (histórico + biblioteca): no "Descobrir" a base tem
// músicas de todos os usuários, e com bônus pequeno as de fora ganhavam quase sempre (são muitas mais).
const HISTORY_BONUS = NEAR_RADIUS / 3;
const RECENT_PENALTY = NEAR_RADIUS / 2; // já sugerida há pouco: só volta se não houver outra razoável
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

// A mesma música pode existir em vários lançamentos (single, álbum, ao vivo…) com ids diferentes.
function songKey(candidate: JourneyCandidate): string {
    return `${candidate.title}|${candidate.artist}`.toLowerCase().trim();
}

export type PickOptions = {
    // 1 = sempre a mais próxima. >1 = sorteia entre as N mais próximas dentro do raio.
    randomTopK?: number;
    rng?: () => number;
    // "Descobrir" (minhas + de fora): música de fora só entra se se encaixar no humor da parada
    // (dentro do raio); só as do usuário podem entrar como aproximadas.
    othersMustFit?: boolean;
    // Ids sugeridos em playlists recentes: perdem posição para não repetir sempre as mesmas.
    recentIds?: Set<string>;
};

// Escolhe, em ordem, a candidata mais próxima de cada parada: sem repetir música
// e evitando o mesmo artista em sequência (a menos que não haja outra opção).
export function pickAlongPath(path: Vector[], candidates: JourneyCandidate[], options: PickOptions = {}): JourneyPick[] {
    const topK = Math.max(1, options.randomTopK ?? 1);
    const rng = options.rng ?? Math.random;
    const recentIds = options.recentIds ?? new Set<string>();
    const othersMustFit = options.othersMustFit ?? false;
    const used = new Set<string>();
    const picks: JourneyPick[] = [];

    path.forEach((point, stop) => {
        const previousArtist = picks[picks.length - 1]?.candidate.artist;
        const ranked = candidates
            .filter(c => !used.has(c.spotifyId) && !used.has(songKey(c)))
            .map(c => {
                const d = distance(point, c.vector);
                const score = d - (c.fromUserHistory ? HISTORY_BONUS : 0) + (recentIds.has(c.spotifyId) ? RECENT_PENALTY : 0);
                return { candidate: c, distance: d, score };
            })
            .filter(r => !othersMustFit || r.candidate.fromUserHistory || r.distance <= NEAR_RADIUS)
            .sort((a, b) => a.score - b.score);

        const otherArtist = ranked.filter(r => r.candidate.artist !== previousArtist);
        const options = otherArtist.length ? otherArtist : ranked;
        const near = options.filter(r => r.distance <= NEAR_RADIUS).slice(0, topK);
        const best = topK > 1 && near.length ? near[Math.floor(rng() * near.length)] : options[0];
        if (!best) return;

        used.add(best.candidate.spotifyId);
        used.add(songKey(best.candidate));
        picks.push({ candidate: best.candidate, stop, distance: best.distance, approximate: best.distance > NEAR_RADIUS });
    });

    return picks;
}

export function totalDurationMs(picks: JourneyPick[]): number {
    return picks.reduce((sum, p) => sum + trackDuration(p.candidate), 0);
}

// Ajusta o número de paradas até a soma das durações reais ficar perto do alvo.
export function buildJourney(
    from: Vector,
    to: Vector,
    durationMin: number,
    candidates: JourneyCandidate[],
    options: PickOptions = {},
): JourneyPick[] {
    const targetMs = durationMin * 60_000;
    let stops = stopCountForDuration(durationMin);
    let best: JourneyPick[] = [];
    const tried = new Set<number>();

    while (!tried.has(stops) && stops >= MIN_STOPS && stops <= MAX_STOPS) {
        tried.add(stops);
        const picks = pickAlongPath(buildPath(from, to, stops), candidates, options);
        const diff = totalDurationMs(picks) - targetMs;

        if (!best.length || Math.abs(diff) < Math.abs(totalDurationMs(best) - targetMs)) best = picks;
        if (Math.abs(diff) <= DURATION_TOLERANCE_MS || picks.length < stops) break; // bom o bastante, ou acabaram as músicas

        stops += diff < 0 ? 1 : -1;
    }

    return best;
}

// Sentimentos por onde a linha reta de `from` a `to` passa (o sentimento mais próximo de cada
// ponto amostrado), na ordem. Começa em `fromLabel` e termina em `toLabel`. É o mesmo caminho
// que a playlist percorre, resumido em sentimentos (usado para desenhar o trajeto na UI).
export function waypointsAlong(
    fromLabel: string,
    toLabel: string,
    clusters: Record<string, Vector>,
    samples = 24,
): string[] {
    const from = clusters[fromLabel];
    const to = clusters[toLabel];
    if (!from || !to) return [fromLabel, toLabel];

    const labels = Object.keys(clusters);
    const nearest = (point: Vector) =>
        labels.reduce((best, label) => (distance(point, clusters[label]) < distance(point, clusters[best]) ? label : best), labels[0]);

    const sequence: string[] = [fromLabel];
    for (const point of buildPath(from, to, samples).slice(1, -1)) {
        const label = nearest(point);
        if (label !== fromLabel && label !== toLabel && label !== sequence[sequence.length - 1]) sequence.push(label);
    }
    sequence.push(toLabel);
    return sequence;
}
