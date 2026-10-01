import { SUBGENRE_TO_GENRE } from 'src/shared/infra/IA/AiText.service';

// "Por pedido" com estilo: o que buscar no Spotify e o teste de gênero das músicas encontradas.

// Palavras que não dizem nada sobre a música ("quero um som de mpb"): sem outra palavra, o pedido é só o gênero.
const FILLER = new Set([
    'quero', 'queria', 'toca', 'tocar', 'toque', 'coloca', 'bota', 'musica', 'musicas', 'som', 'sons', 'playlist',
    'umas', 'algo', 'alguma', 'algumas', 'para', 'pra', 'pro', 'mais', 'bem', 'estilo', 'tipo', 'genero', 'ouvir',
    'some', 'music', 'songs', 'play',
]);
const MIN_WORD = 3;

function plain(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Buscas de texto no Spotify. Com gênero reconhecido (as músicas dele vêm das paradas do Last.fm), só o resto
// do pedido, se disser mais que o gênero (artista, época…): buscar o nome do gênero como texto trazia música
// com a palavra no título ("Heavy Metal Machine", "MPB (Ela ouve serenata)"). Sem gênero, o pedido inteiro e
// cada parte dele ("rock, samba").
export function requestQueries(request: string, genre: string | null): string[] {
    if (genre) {
        const genreWords = new Set(plain(genre).split(/[\s/&-]+/));
        const rest = plain(request).split(/[^a-z0-9]+/).filter(w => w && !genreWords.has(w));
        const meaningful = rest.some(w => w.length >= MIN_WORD && !FILLER.has(w));
        return meaningful ? [rest.join(' ')] : [];
    }
    const parts = request
        .split(/,|;|\+|\s+e\s+|\s+and\s+/i)
        .map(p => p.trim())
        .filter(p => p.length > 1);
    return [...new Set([request.trim(), ...(parts.length > 1 ? parts : [])])];
}

// A música é do gênero pedido pelo rótulo do Jev: o mesmo subgênero ou o mesmo gênero dele (pediu "Heavy
// Metal", serve Metal). Sem gênero pedido, qualquer uma.
export function matchesRequestedGenre(candidate: { genre?: string | null; subgenre?: string | null }, genre: string | null): boolean {
    if (!genre) return true;
    const parent = SUBGENRE_TO_GENRE[genre] ?? genre;
    return candidate.subgenre === genre || candidate.genre === parent;
}
