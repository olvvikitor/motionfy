import { SUBGENRE_TO_GENRE } from 'src/shared/infra/IA/AiText.service';

// Filtros da geração de playlist escolhidos pelo usuário: gêneros, subgêneros e faixas de BPM, cada um
// com mais de uma opção. Gênero escolhido vale inteiro, a não ser que algum subgênero dele também esteja
// escolhido: aí afunila para esses subgêneros ("Rock" + "Indie Rock" = só indie rock). Subgênero de um
// gênero não escolhido soma. BPM restringe (tem que estar numa das faixas; sem BPM conhecido, fica de fora).
// Época também restringe, pelo ano de lançamento (do álbum, no Spotify); sem ano conhecido, fica de fora.

export const BPM_RANGES = {
    slow: { min: 0, max: 90 },
    medium: { min: 90, max: 120 },
    fast: { min: 120, max: 150 },
    veryfast: { min: 150, max: Infinity },
} as const;
export type BpmRange = keyof typeof BPM_RANGES;
export const BPM_RANGE_KEYS = Object.keys(BPM_RANGES) as BpmRange[];

// Época pelo ano de lançamento: separa a MPB clássica do pop atual que também cai em MPB (idem outros gêneros).
export const ERAS = {
    pre80: { min: 0, max: 1980 },
    '80s': { min: 1980, max: 1990 },
    '90s': { min: 1990, max: 2000 },
    '00s': { min: 2000, max: 2010 },
    '10s': { min: 2010, max: 2020 },
    '20s': { min: 2020, max: Infinity },
} as const;
export type Era = keyof typeof ERAS;
export const ERA_KEYS = Object.keys(ERAS) as Era[];

// Música nacional (brasileira): include = entra tudo (padrão), exclude = sem nacional, only = só nacional.
export const NATIONAL_OPTIONS = ['include', 'exclude', 'only'] as const;
export type NationalOption = typeof NATIONAL_OPTIONS[number];

export type JourneyFilters = { genres?: string[]; subgenres?: string[]; bpm?: BpmRange[]; eras?: Era[]; national?: NationalOption };
type Filterable = { genre?: string | null; subgenre?: string | null; bpm?: number | null; year?: number | null; artistCountry?: string | null };

const norm = (value: string) => value.trim().toLowerCase();
const GENRE_OF = new Map(Object.entries(SUBGENRE_TO_GENRE).map(([sub, genre]) => [norm(sub), norm(genre)]));

// Gêneros e subgêneros do Jev que são brasileiros (só escolhem de onde vêm as populares; quem decide se a
// música é nacional é o país do artista).
const NATIONAL_GENRES = new Set([
    'Rock Nacional', 'Rap Nacional', 'Trap BR', 'Funk', 'Funk Carioca', 'Brega Funk', 'Sertanejo', 'Sertanejo Universitário',
    'Sertanejo Raiz', 'Samba/Pagode', 'Pagode', 'Samba', 'MPB', 'Bossa Nova', 'Forró', 'Piseiro', 'Axé', 'Arrocha',
].map(norm));

// Música nacional = artista principal brasileiro, pelo país dele (ArtistInfo: MusicBrainz/Last.fm). Com o filtro
// ligado (sem/só nacional), música de artista sem país conhecido fica de fora: não dá para saber de que lado está.
export function matchesNational(artistCountry: string | null | undefined, option: NationalOption | undefined): boolean {
    if (!option || option === 'include') return true;
    if (typeof artistCountry !== 'string') return false;
    return (artistCountry === 'BR') === (option === 'only');
}

export function isNationalGenre(name: string): boolean {
    return NATIONAL_GENRES.has(norm(name));
}

export function bpmRangeOf(bpm: number | null | undefined): BpmRange | null {
    if (typeof bpm !== 'number') return null;
    return BPM_RANGE_KEYS.find(key => bpm >= BPM_RANGES[key].min && bpm < BPM_RANGES[key].max) ?? null;
}

// Ano de "1975", "1975-03" ou "1975-03-01" (release_date do Spotify).
export function yearOf(releaseDate: string | null | undefined): number | null {
    const year = releaseDate ? Number(releaseDate.slice(0, 4)) : NaN;
    return Number.isInteger(year) && year > 1000 ? year : null;
}

export function eraOf(year: number | null | undefined): Era | null {
    if (typeof year !== 'number') return null;
    return ERA_KEYS.find(key => year >= ERAS[key].min && year < ERAS[key].max) ?? null;
}

export function matchesEra(year: number | null | undefined, eras: Era[] | undefined): boolean {
    if (!eras?.length) return true;
    const era = eraOf(year);
    return Boolean(era && eras.includes(era));
}

export function hasFilters(filters: JourneyFilters): boolean {
    return Boolean(filters.genres?.length || filters.subgenres?.length || filters.bpm?.length || filters.eras?.length || (filters.national && filters.national !== 'include'));
}

// Gêneros e subgêneros que valem nos filtros: os subgêneros e os gêneros que não foram afunilados por um
// subgênero seu ("Rock" + "Indie Rock" = só "Indie Rock"). Usado para buscar as populares desses gêneros.
export function chosenGenres(filters: JourneyFilters): string[] {
    const subgenres = filters.subgenres ?? [];
    const narrowed = new Set(subgenres.map(sub => GENRE_OF.get(norm(sub))).filter(Boolean));
    return [...subgenres, ...(filters.genres ?? []).filter(genre => !narrowed.has(norm(genre)))];
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
    if (!matchesEra(track.year, filters.eras)) return false;
    return matchesNational(track.artistCountry, filters.national);
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
