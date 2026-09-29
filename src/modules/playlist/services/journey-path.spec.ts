import {
    buildJourney,
    buildPath,
    distance,
    findGaps,
    FIT_RADIUS,
    capPerArtist,
    isNovel,
    NEIGHBOR_RADIUS,
    songKey,
    moodAreas,
    JourneyCandidate,
    pickAlongPath,
    stopCountForDuration,
    suggestionFatigue,
    totalDurationMs,
    Vector,
    waypointsAlong,
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

    it('pickAlongPath com `fits` aceita qualquer música que sirva, longe ou perto da parada', () => {
        const far = candidate('far', { a: 5, b: 5 }, { dominantSentiment: 'Paz' });
        const near = candidate('near', FROM, { dominantSentiment: 'Tristeza' });
        const picks = pickAlongPath(buildPath(FROM, TO, 1), [near, far], { fits: c => c.dominantSentiment === 'Paz' });
        expect(picks[0].candidate.spotifyId).toBe('far');
        expect(picks[0].approximate).toBe(false);
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

    it('pickAlongPath não repete a mesma música vinda de outro lançamento (id diferente)', () => {
        const pool = [
            candidate('single', FROM, { title: 'The Aftermath', artist: 'Da Youngsta\'s' }),
            candidate('album', { a: 0.1, b: 0.9 }, { title: 'The Aftermath', artist: 'Da Youngsta\'s' }),
            candidate('other', { a: 0.3, b: 0.7 }),
        ];
        const picks = pickAlongPath(buildPath(FROM, FROM, 2), pool);
        expect(picks.map(p => p.candidate.spotifyId)).toEqual(['single', 'other']);
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
        expect(pick.distance).toBeGreaterThan(FIT_RADIUS);
    });

    it('pickAlongPath prefere música do histórico em empate próximo', () => {
        const pool = [
            candidate('new', { a: 0, b: 0.98 }),
            candidate('mine', { a: 0, b: 0.96 }, { fromUserHistory: true }),
        ];
        expect(pickAlongPath([FROM], pool)[0].candidate.spotifyId).toBe('mine');
    });

    it('sample cai na mais próxima, aproximada, quando nada está no raio', () => {
        const pool = [candidate('longe', { a: 3, b: 3 }), candidate('menos-longe', { a: 1, b: 2 })];
        const [pick] = pickAlongPath([FROM], pool, { sample: true, rng: () => 0.99 });
        expect(pick.candidate.spotifyId).toBe('menos-longe');
        expect(pick.approximate).toBe(true);
    });

    it('Descobrir: música de fora que não se encaixa no humor fica de fora (a do usuário pode ser aproximada)', () => {
        const pool = [
            candidate('fora-longe', { a: 3, b: 3 }),
            candidate('minha-longe', { a: 4, b: 4 }, { fromUserHistory: true }),
        ];
        const picks = pickAlongPath([FROM], pool, { othersMustFit: true });
        expect(picks.map(p => p.candidate.spotifyId)).toEqual(['minha-longe']);
        expect(picks[0].approximate).toBe(true);
    });

    it('Descobrir: sem nenhuma que se encaixe, a parada fica vazia em vez de usar música de fora qualquer', () => {
        const picks = pickAlongPath([FROM], [candidate('fora-longe', { a: 3, b: 3 })], { othersMustFit: true });
        expect(picks).toEqual([]);
    });

    it('prefere a música do usuário a uma de fora um pouco mais perto', () => {
        const pool = [
            candidate('fora', { a: 0, b: 1 }),
            candidate('minha', { a: 0.05, b: 1 }, { fromUserHistory: true }), // 0,05 < bônus 0,08
        ];
        expect(pickAlongPath([FROM], pool)[0].candidate.spotifyId).toBe('minha');
    });

    it('suggestionFatigue soma por vez sugerida e decai com o tempo', () => {
        const now = new Date('2026-09-26T12:00:00Z');
        const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
        const fatigue = suggestionFatigue([
            { spotifyId: 'a', suggestedAt: daysAgo(0) },
            { spotifyId: 'a', suggestedAt: daysAgo(1) },
            { spotifyId: 'a', suggestedAt: daysAgo(2) },
            { spotifyId: 'b', suggestedAt: daysAgo(0) },
            { spotifyId: 'c', suggestedAt: daysAgo(25) },
        ], now);
        expect(fatigue.get('a')!).toBeGreaterThan(fatigue.get('b')!);
        expect(fatigue.get('b')!).toBeCloseTo(0.25, 2);
        expect(fatigue.get('c')!).toBeLessThan(0.03);
        expect(fatigue.has('d')).toBe(false);
    });

    it('isNovel: nem do usuário nem sugerida antes', () => {
        const fatigue = new Map([['cansada', 0.2]]);
        expect(isNovel(candidate('x', FROM), fatigue)).toBe(true);
        expect(isNovel(candidate('x', FROM, { fromUserHistory: true }), fatigue)).toBe(false);
        expect(isNovel(candidate('cansada', FROM), fatigue)).toBe(false);
    });

    it('música cansada perde para uma alternativa razoável', () => {
        const pool = [candidate('cansada', FROM), candidate('alt', { a: 0.1, b: 1 })];
        const [pick] = pickAlongPath([FROM], pool, { fatigue: new Map([['cansada', 0.5]]) });
        expect(pick.candidate.spotifyId).toBe('alt');
    });

    it('música cansada volta se a alternativa está fora do raio', () => {
        const pool = [candidate('cansada', FROM), candidate('longe', { a: FIT_RADIUS + 0.3, b: 1 })];
        const [pick] = pickAlongPath([FROM], pool, { fatigue: new Map([['cansada', 0.5]]) });
        expect(pick.candidate.spotifyId).toBe('cansada');
    });

    it('no máximo 2 músicas do mesmo artista quando há alternativa', () => {
        const path = [FROM, FROM, FROM, FROM, FROM];
        const pool = [
            ...['1', '2', '3', '4'].map(id => candidate(`x${id}`, { a: 0.01 * Number(id), b: 1 }, { artist: 'X' })),
            candidate('y1', { a: 0.2, b: 1 }, { artist: 'Y' }),
            candidate('z1', { a: 0.25, b: 1 }, { artist: 'Z' }),
            candidate('w1', { a: 0.3, b: 1 }, { artist: 'W' }),
        ];
        const picks = pickAlongPath(path, pool);
        expect(picks).toHaveLength(5);
        expect(picks.filter(p => p.candidate.artist === 'X')).toHaveLength(2);
    });

    it('colaboração conta como o artista principal', () => {
        const path = [FROM, FROM, FROM];
        const pool = [
            candidate('x1', FROM, { artist: 'X' }),
            candidate('x2', { a: 0.01, b: 1 }, { artist: 'X, Fulano' }),
            candidate('x3', { a: 0.02, b: 1 }, { artist: 'x' }),
            candidate('y1', { a: 0.3, b: 1 }, { artist: 'Y' }),
        ];
        const ids = pickAlongPath(path, pool).map(p => p.candidate.spotifyId);
        expect(ids).toContain('y1');
    });

    it('fura o teto de artista quando não sobra outra música', () => {
        const path = [FROM, FROM, FROM];
        const pool = ['1', '2', '3'].map(id => candidate(`x${id}`, { a: 0.01 * Number(id), b: 1 }, { artist: 'X' }));
        expect(pickAlongPath(path, pool)).toHaveLength(3);
    });

    it('música quase igual a uma já escolhida perde posição', () => {
        const path = [FROM, FROM];
        const pool = [
            candidate('a', FROM),
            candidate('gemea', { a: 0.01, b: 1 }),
            candidate('diferente', { a: 0.09, b: 1 }), // score 0,09 < gêmea 0,01 + 0,1
        ];
        const ids = pickAlongPath(path, pool).map(p => p.candidate.spotifyId);
        expect(ids).toEqual(['a', 'diferente']);
    });

    it('sample: rng baixo pega a melhor, rng alto pega outra do raio, nunca fora do raio', () => {
        const pool = [
            candidate('best', FROM),
            candidate('mid', { a: 0.05, b: 1 }),
            candidate('edge', { a: 0.1, b: 1 }),
            candidate('fora', { a: FIT_RADIUS + 0.2, b: 1 }),
        ];
        const pickWith = (value: number) => pickAlongPath([FROM], pool, { sample: true, rng: () => value })[0].candidate.spotifyId;
        expect(pickWith(0)).toBe('best');
        expect(pickWith(0.999)).toBe('edge');
        for (const v of [0, 0.2, 0.5, 0.8, 0.999]) expect(pickWith(v)).not.toBe('fora');
    });

    it('sample com scores negativos e iguais não quebra', () => {
        const pool = [
            candidate('a', FROM, { fromUserHistory: true }),
            candidate('b', FROM, { fromUserHistory: true, title: 'Outra', artist: 'Outro' }),
        ];
        const [pick] = pickAlongPath([FROM], pool, { sample: true, rng: () => 0.7 });
        expect(['a', 'b']).toContain(pick.candidate.spotifyId);
    });

    it('cota de novidade: ao menos 30% de músicas novas quando existem', () => {
        const path = Array.from({ length: 10 }, () => FROM);
        const mine = Array.from({ length: 10 }, (_, i) => candidate(`m${i}`, { a: 0.01 * i, b: 1 }, { fromUserHistory: true }));
        const novas = Array.from({ length: 5 }, (_, i) => candidate(`n${i}`, { a: 0.2 + 0.01 * i, b: 1 }));
        const picks = pickAlongPath(path, [...mine, ...novas], { noveltyShare: 0.3 });
        expect(picks.filter(p => p.candidate.spotifyId.startsWith('n')).length).toBeGreaterThanOrEqual(3);
    });

    it('cota de novidade sem nenhuma nova no raio usa as do usuário', () => {
        const path = [FROM, FROM, FROM];
        const mine = ['1', '2', '3'].map(id => candidate(`m${id}`, { a: 0.01 * Number(id), b: 1 }, { fromUserHistory: true }));
        expect(pickAlongPath(path, mine, { noveltyShare: 0.3 })).toHaveLength(3);
    });

    it('música do usuário perde para uma de fora bem mais perto', () => {
        const pool = [
            candidate('minha', { a: 0.2, b: 1 }, { fromUserHistory: true }),
            candidate('fora', FROM),
        ];
        expect(pickAlongPath([FROM], pool)[0].candidate.spotifyId).toBe('fora');
    });

    it('buildJourney com partida = chegada fica no mesmo humor, sem repetir música', () => {
        const near = Array.from({ length: 12 }, (_, i) => candidate(`n${i}`, { a: 0.01 * i, b: 1 - 0.01 * i }));
        const far = [candidate('far', { a: 1, b: 0 })];
        const picks = buildJourney(FROM, FROM, 30, [...near, ...far]);
        const ids = picks.map(p => p.candidate.spotifyId);
        expect(picks.length).toBeGreaterThan(3);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain('far');
        expect(picks.every(p => distance(FROM, p.candidate.vector) <= FIT_RADIUS)).toBe(true);
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

describe('waypointsAlong', () => {
    const clusters: Record<string, Vector> = {
        A: { x: 0, y: 0 },
        B: { x: 1, y: 0 },
        C: { x: 2, y: 0 },
        D: { x: 3, y: 0 },
        Far: { x: 1.5, y: 5 },
    };

    it('passa pelos sentimentos no meio do caminho, em ordem', () => {
        expect(waypointsAlong('A', 'D', clusters)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('não inclui sentimentos longe da linha', () => {
        expect(waypointsAlong('A', 'D', clusters)).not.toContain('Far');
    });

    it('vizinhos diretos não têm paradas no meio', () => {
        expect(waypointsAlong('A', 'B', clusters)).toEqual(['A', 'B']);
    });

    it('sentimento desconhecido volta só as pontas', () => {
        expect(waypointsAlong('A', 'Nope', clusters)).toEqual(['A', 'Nope']);
    });
});

describe('moodAreas', () => {
    const r = NEIGHBOR_RADIUS;
    const clusters: Record<string, Vector> = {
        A: { a: 0, b: 0 },
        perto: { a: r - 0.05, b: 0 },
        meio: { a: r / 2, b: 0 },
        longe: { a: r + 0.05, b: 0 },
    };

    it('traz os humores a até NEIGHBOR_RADIUS, do mais perto ao mais longe', () => {
        expect(moodAreas(clusters).A).toEqual(['meio', 'perto']);
    });

    it('não inclui o próprio humor', () => {
        expect(moodAreas(clusters).longe).not.toContain('longe');
    });
});

describe('humor da parada (moodOf)', () => {
    it('prefere a do humor da parada, mesmo mais longe, a uma de outro humor mais perto', () => {
        const near = candidate('near', FROM, { dominantSentiment: 'Confianca' });
        const own = candidate('own', { a: 0.3, b: 0.9 }, { dominantSentiment: 'Energia' });
        const picks = pickAlongPath(buildPath(FROM, TO, 1), [near, own], { moodOf: () => 'Energia' });
        expect(picks[0].candidate.spotifyId).toBe('own');
    });

    it('a cota de novas não troca uma do humor por uma nova de outro humor', () => {
        const mine = candidate('mine', FROM, { dominantSentiment: 'Paz', fromUserHistory: true });
        const novelOther = candidate('novel', FROM, { dominantSentiment: 'Amor' });
        const picks = pickAlongPath(buildPath(FROM, TO, 1), [mine, novelOther], {
            moodOf: () => 'Paz', noveltyShare: 1, fits: c => ['Paz', 'Amor'].includes(c.dominantSentiment),
        });
        expect(picks[0].candidate.spotifyId).toBe('mine');
    });

    it('usa um humor próximo quando acabam as do humor escolhido', () => {
        const own = candidate('own', FROM, { dominantSentiment: 'Paz' });
        const other = candidate('other', FROM, { dominantSentiment: 'Amor', artist: 'Outro' });
        const picks = pickAlongPath([FROM, FROM], [own, other], { moodOf: () => 'Paz', fits: () => true });
        expect(picks.map(p => p.candidate.spotifyId)).toEqual(['own', 'other']);
    });

    it('findGaps conta como coberta a parada com música do humor dela, mesmo longe', () => {
        const far = candidate('far', { a: 9, b: 9 }, { dominantSentiment: 'Paz' });
        expect(findGaps([FROM], [far], () => 'Paz')).toEqual([]);
        expect(findGaps([FROM], [far])).toEqual([0]);
    });
});

describe('fluxo entre músicas', () => {
    it('depois de um gênero, prefere seguir nele a trocar', () => {
        const first = candidate('first', FROM, { genre: 'Rock', artist: 'A' });
        const rock = candidate('rock', { a: 0.02, b: 0.98 }, { genre: 'Rock', artist: 'B' });
        const trap = candidate('trap', FROM, { genre: 'Hip Hop', artist: 'C' });
        const picks = pickAlongPath([FROM, FROM], [first, rock, trap]);
        expect(picks[1].candidate.spotifyId).toBe('rock');
    });
});

describe('capPerArtist e songKey', () => {
    it('deixa no máximo 2 por artista', () => {
        const list = [1, 2, 3, 4].map(i => candidate(String(i), FROM, { artist: 'Raça Negra' }));
        expect(capPerArtist(list)).toHaveLength(2);
    });

    it('versão ao vivo/remaster/feat conta como a mesma música', () => {
        const base = candidate('a', FROM, { title: 'É O Amor', artist: 'Raça Negra' });
        expect(songKey(candidate('b', FROM, { title: 'É O Amor - Ao Vivo', artist: 'Raça Negra' }))).toBe(songKey(base));
        expect(songKey(candidate('c', FROM, { title: 'É O Amor (feat. X)', artist: 'Raça Negra, X' }))).toBe(songKey(base));
    });
});
