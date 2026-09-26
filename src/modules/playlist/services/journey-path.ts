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
// Música "combina" com a parada. Menor que a distância entre humores vizinhos
// (Tensão↔Frustração 0,42; Tristeza↔Melancolia 0,51): 0,6 aceitava música de outro humor.
export const FIT_RADIUS = 0.45;
export const MIN_STOPS = 3;
// Preferência leve pelas músicas do usuário: com bônus grande elas ganhavam sempre e, como são
// poucas perto de cada humor, toda playlist repetia as mesmas.
const HISTORY_BONUS = 0.08;
// Cansaço: cada vez que a música foi sugerida pesa FATIGUE_WEIGHT, decaindo com o tempo.
const FATIGUE_WEIGHT = 0.25;
const FATIGUE_DECAY_DAYS = 10;
// Variedade dentro da playlist.
const ARTIST_PENALTY = 0.15; // por música do mesmo artista já escolhida
const MAX_PER_ARTIST = 2; // só passa disso se não sobrar outra
const SIMILAR_DISTANCE = 0.08; // vetor quase igual a uma já escolhida
const SIMILAR_PENALTY = 0.1;
// Sorteio com peso exp(-score/T): quanto menor, mais concentrado na melhor.
const SAMPLE_TEMPERATURE = 0.08;
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
        .filter(({ nearest }) => nearest > FIT_RADIUS)
        .map(({ index }) => index);
}

export function trackDuration(candidate: JourneyCandidate): number {
    return candidate.durationMs ?? DEFAULT_TRACK_MS;
}

// A mesma música pode existir em vários lançamentos (single, álbum, ao vivo…) com ids diferentes.
function songKey(candidate: JourneyCandidate): string {
    return `${candidate.title}|${candidate.artist}`.toLowerCase().trim();
}

// "A, B" (colaboração) conta como o artista principal.
export function primaryArtist(artist: string): string {
    return artist.split(', ')[0].trim().toLowerCase();
}

function artistKey(candidate: JourneyCandidate): string {
    return primaryArtist(candidate.artist);
}

// Quanto cada música já cansou: soma das sugestões, cada uma decaindo com a idade.
export function suggestionFatigue(rows: { spotifyId: string; suggestedAt: Date }[], now: Date): Map<string, number> {
    const fatigue = new Map<string, number>();
    for (const row of rows) {
        const ageDays = Math.max(0, (now.getTime() - row.suggestedAt.getTime()) / 86_400_000);
        const weight = FATIGUE_WEIGHT * Math.exp(-ageDays / FATIGUE_DECAY_DAYS);
        fatigue.set(row.spotifyId, (fatigue.get(row.spotifyId) ?? 0) + weight);
    }
    return fatigue;
}

// Novidade para o usuário: não é dele e nunca foi sugerida a ele (na janela do cansaço).
export function isNovel(candidate: JourneyCandidate, fatigue: Map<string, number>): boolean {
    return !candidate.fromUserHistory && !fatigue.has(candidate.spotifyId);
}

// Sorteio com peso relativo à melhor (itens em ordem crescente de score).
function weightedPick<T extends { score: number }>(items: T[], rng: () => number): T {
    const weights = items.map(item => Math.exp(-(item.score - items[0].score) / SAMPLE_TEMPERATURE));
    let target = rng() * weights.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < items.length; i++) {
        target -= weights[i];
        if (target < 0) return items[i];
    }
    return items[items.length - 1];
}

export type PickOptions = {
    // Sorteia entre as que combinam com a parada, com mais chance para as mais próximas.
    // Sem isso, sempre a de menor score (determinístico).
    sample?: boolean;
    rng?: () => number;
    // "Descobrir" (minhas + de fora): música de fora só entra se se encaixar no humor da parada
    // (dentro do raio); só as do usuário podem entrar como aproximadas.
    othersMustFit?: boolean;
    // Cansaço por música (suggestionFatigue): as sugeridas muitas vezes/há pouco perdem posição.
    fatigue?: Map<string, number>;
    // Parte da playlist reservada a músicas novas para o usuário (isNovel), quando houver no raio.
    noveltyShare?: number;
};

// Escolhe, em ordem, uma música para cada parada: sem repetir música, no máximo MAX_PER_ARTIST
// por artista e evitando o mesmo artista em sequência (a menos que não haja outra opção).
export function pickAlongPath(path: Vector[], candidates: JourneyCandidate[], options: PickOptions = {}): JourneyPick[] {
    const rng = options.rng ?? Math.random;
    const fatigue = options.fatigue ?? new Map<string, number>();
    const noveltyShare = options.noveltyShare ?? 0;
    const used = new Set<string>();
    const perArtist = new Map<string, number>();
    const picks: JourneyPick[] = [];
    let novelPicked = 0;

    path.forEach((point, stop) => {
        const previousArtist = picks.length ? artistKey(picks[picks.length - 1].candidate) : undefined;
        const ranked = candidates
            .filter(c => !used.has(c.spotifyId) && !used.has(songKey(c)))
            .map(c => {
                const d = distance(point, c.vector);
                const artist = artistKey(c);
                const artistCount = perArtist.get(artist) ?? 0;
                const similar = picks.some(p => distance(p.candidate.vector, c.vector) < SIMILAR_DISTANCE);
                const score = d
                    - (c.fromUserHistory ? HISTORY_BONUS : 0)
                    + (fatigue.get(c.spotifyId) ?? 0)
                    + artistCount * ARTIST_PENALTY
                    + (similar ? SIMILAR_PENALTY : 0);
                return { candidate: c, distance: d, score, artist, artistCount };
            })
            .filter(r => !options.othersMustFit || r.candidate.fromUserHistory || r.distance <= FIT_RADIUS)
            .sort((a, b) => a.score - b.score);

        // Da regra mais exigente para a mais solta; fica na primeira que tiver música no raio.
        const layers = [
            ranked.filter(r => r.artistCount < MAX_PER_ARTIST && r.artist !== previousArtist),
            ranked.filter(r => r.artistCount < MAX_PER_ARTIST),
            ranked,
        ];
        const layer = layers.find(l => l.some(r => r.distance <= FIT_RADIUS)) ?? layers.find(l => l.length) ?? [];
        let fit = layer.filter(r => r.distance <= FIT_RADIUS);

        const novelBehind = novelPicked < Math.round(noveltyShare * (stop + 1));
        const novelFit = fit.filter(r => isNovel(r.candidate, fatigue));
        if (novelBehind && novelFit.length) fit = novelFit;

        const best = fit.length ? (options.sample ? weightedPick(fit, rng) : fit[0]) : layer[0];
        if (!best) return;

        used.add(best.candidate.spotifyId);
        used.add(songKey(best.candidate));
        perArtist.set(best.artist, (perArtist.get(best.artist) ?? 0) + 1);
        if (isNovel(best.candidate, fatigue)) novelPicked++;
        picks.push({ candidate: best.candidate, stop, distance: best.distance, approximate: best.distance > FIT_RADIUS });
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
