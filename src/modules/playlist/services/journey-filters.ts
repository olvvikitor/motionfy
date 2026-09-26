import { SUBGENRE_TO_GENRE } from 'src/shared/infra/IA/AiText.service';

// Filtros da geração de playlist escolhidos pelo usuário: gêneros, subgêneros e faixas de BPM, cada um
// com mais de uma opção. Gênero escolhido vale inteiro, a não ser que algum subgênero dele também esteja
// escolhido: aí afunila para esses subgêneros ("Rock" + "Indie Rock" = só indie rock). Subgênero de um
// gênero não escolhido soma. BPM restringe (tem que estar numa das faixas; sem BPM conhecido, fica de fora).

export const BPM_RANGES = {
    slow: { min: 0, max: 90 },
    medium: { min: 90, max: 120 },
    fast: { min: 120, max: 150 },
    veryfast: { min: 150, max: Infinity },
} as const;
export type BpmRange = keyof typeof BPM_RANGES;
export const BPM_RANGE_KEYS = Object.keys(BPM_RANGES) as BpmRange[];

export type JourneyFilters = { genres?: string[]; subgenres?: string[]; bpm?: BpmRange[] };
type Filterable = { genre?: string | null; subgenre?: string | null; bpm?: number | null };

const norm = (value: string) => value.trim().toLowerCase();
const GENRE_OF = new Map(Object.entries(SUBGENRE_TO_GENRE).map(([sub, genre]) => [norm(sub), norm(genre)]));

export function bpmRangeOf(bpm: number | null | undefined): BpmRange | null {
    if (typeof bpm !== 'number') return null;
    return BPM_RANGE_KEYS.find(key => bpm >= BPM_RANGES[key].min && bpm < BPM_RANGES[key].max) ?? null;
}

export function hasFilters(filters: JourneyFilters): boolean {
    return Boolean(filters.genres?.length || filters.subgenres?.length || filters.bpm?.length);
}

export function matchesFilters(track: Filterable, filters: JourneyFilters): boolean {
    const genres = new Set((filters.genres ?? []).map(norm));
    const subgenres = new Set((filters.subgenres ?? []).map(norm));
    if (genres.size || subgenres.size) {
        // Gêneros afunilados: os que têm algum subgênero escolhido.
        const narrowed = new Set([...subgenres].map(sub => GENRE_OF.get(sub)).filter((g): g is string => Boolean(g)));
        const bySubgenre = Boolean(track.subgenre && subgenres.has(norm(track.subgenre)));
        const genre = track.genre ? norm(track.genre) : null;
        const byGenre = Boolean(genre && genres.has(genre) && !narrowed.has(genre));
        if (!byGenre && !bySubgenre) return false;
    }
    if (filters.bpm?.length) {
        const range = bpmRangeOf(track.bpm);
        if (!range || !filters.bpm.includes(range)) return false;
    }
    return true;
}

export type FilterFacets = {
    genres: { name: string; count: number }[];
    subgenres: { name: string; genre: string; count: number }[];
    bpm: { range: BpmRange; count: number }[];
};

// Opções dos filtros a partir das músicas do usuário (histórico + biblioteca), das mais comuns.
export function buildFacets(tracks: Filterable[]): FilterFacets {
    const genres = new Map<string, number>();
    const subgenres = new Map<string, { genre: string; count: number }>();
    const bpm = new Map<BpmRange, number>();

    for (const t of tracks) {
        if (t.genre && t.genre !== 'Unknown') genres.set(t.genre, (genres.get(t.genre) ?? 0) + 1);
        if (t.subgenre && t.subgenre !== 'Unknown') {
            const current = subgenres.get(t.subgenre);
            subgenres.set(t.subgenre, { genre: current?.genre ?? t.genre ?? 'Unknown', count: (current?.count ?? 0) + 1 });
        }
        const range = bpmRangeOf(t.bpm);
        if (range) bpm.set(range, (bpm.get(range) ?? 0) + 1);
    }

    return {
        genres: [...genres].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        subgenres: [...subgenres].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count),
        bpm: BPM_RANGE_KEYS.map(range => ({ range, count: bpm.get(range) ?? 0 })),
    };
}
