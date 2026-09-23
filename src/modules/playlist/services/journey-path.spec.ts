import {
    buildJourney,
    buildPath,
    distance,
    findGaps,
    JourneyCandidate,
    NEAR_RADIUS,
    pickAlongPath,
    stopCountForDuration,
    totalDurationMs,
    Vector,
} from './journey-path';

const FROM: Vector = { a: 0, b: 1 };
const TO: Vector = { a: 1, b: 0 };

function candidate(id: string, vector: Vector, overrides: Partial<JourneyCandidate> = {}): JourneyCandidate {
    return {
        spotifyId: id,
        title: `Song ${id}`,
        artist: `Artist ${id}`,
        imgUrl: '',
        durationMs: 180_000,
        vector,
        dominantSentiment: 'X',
        fromUserHistory: false,
        ...overrides,
    };
}

// Candidatas espalhadas ao longo da reta de FROM a TO.
function lineCandidates(count: number, overrides: Partial<JourneyCandidate> = {}): JourneyCandidate[] {
    return Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        return candidate(String(i), { a: t, b: 1 - t }, overrides);
    });
}

describe('journey-path', () => {
    it('buildPath começa em from, termina em to e anda em ordem', () => {
        const path = buildPath(FROM, TO, 5);
        expect(path).toHaveLength(5);
        expect(path[0]).toEqual(FROM);
        expect(path[4]).toEqual(TO);
        for (let i = 1; i < path.length; i++) {
            expect(distance(path[i], TO)).toBeLessThan(distance(path[i - 1], TO));
        }
    });

    it('stopCountForDuration respeita o mínimo de 3 paradas', () => {
        expect(stopCountForDuration(1)).toBe(3);
        expect(stopCountForDuration(35)).toBe(10);
    });

    it('findGaps aponta paradas sem candidata dentro do raio', () => {
        const path = buildPath(FROM, TO, 3);
        const gaps = findGaps(path, [candidate('near-from', FROM)]);
        expect(gaps).toEqual([1, 2]);
        expect(findGaps(path, [])).toEqual([0, 1, 2]);
    });

    it('pickAlongPath não repete música e segue a ordem do caminho', () => {
        const picks = pickAlongPath(buildPath(FROM, TO, 5), lineCandidates(5));
        expect(picks.map(p => p.candidate.spotifyId)).toEqual(['0', '1', '2', '3', '4']);
        expect(new Set(picks.map(p => p.candidate.spotifyId)).size).toBe(5);
    });

    it('pickAlongPath evita o mesmo artista em sequência quando há alternativa', () => {
        const pool = [
            candidate('a1', FROM, { artist: 'Same' }),
            candidate('a2', FROM, { artist: 'Same' }),
            candidate('b1', { a: 0.1, b: 0.9 }, { artist: 'Other' }),
        ];
        const picks = pickAlongPath(buildPath(FROM, FROM, 2), pool);
        expect(picks[0].candidate.artist).toBe('Same');
        expect(picks[1].candidate.artist).toBe('Other');
    });

    it('pickAlongPath marca como aproximada a música fora do raio', () => {
        const far = candidate('far', { a: 5, b: 5 });
        const [pick] = pickAlongPath([FROM], [far]);
        expect(pick.approximate).toBe(true);
        expect(pick.distance).toBeGreaterThan(NEAR_RADIUS);
    });

    it('pickAlongPath prefere música do histórico em empate próximo', () => {
        const pool = [
            candidate('new', { a: 0, b: 0.98 }),
            candidate('mine', { a: 0, b: 0.96 }, { fromUserHistory: true }),
        ];
        expect(pickAlongPath([FROM], pool)[0].candidate.spotifyId).toBe('mine');
    });

    it('buildJourney fecha perto da duração pedida', () => {
        const picks = buildJourney(FROM, TO, 30, lineCandidates(40));
        expect(Math.abs(totalDurationMs(picks) - 30 * 60_000)).toBeLessThanOrEqual(120_000);
        expect(picks[0].candidate.spotifyId).toBe('0');
        expect(picks[picks.length - 1].candidate.spotifyId).toBe('39');
    });

    it('buildJourney usa o que tiver quando faltam músicas', () => {
        const picks = buildJourney(FROM, TO, 60, lineCandidates(4));
        expect(picks).toHaveLength(4);
    });
});
