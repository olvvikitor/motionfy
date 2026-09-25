import axios, { AxiosError, AxiosHeaders } from 'axios';
import { SpotifyCatalogService } from './spotify-catalog.service';

// Depois de um 429, o catálogo não chama mais o Spotify até o Retry-After; o que já está
// no banco continua sendo resolvido.
describe('SpotifyCatalogService — limite de chamadas', () => {
    const known = { spotifyId: 'id-conhecida', title: 'Elephant', artist: 'Tame Impala', album: '', img_url: '', isrc: null, explicit: null, releaseDate: null, durationMs: null };
    const prisma = {
        track: {
            findMany: jest.fn(async ({ where }: { where: { title: { equals: string } } }) =>
                where.title.equals.toLowerCase() === 'elephant' ? [known] : []),
        },
    };

    afterEach(() => jest.restoreAllMocks());

    function tooManyRequests(retryAfter: string) {
        const headers = new AxiosHeaders({ 'retry-after': retryAfter });
        return new AxiosError('Too many requests', '429', undefined, undefined, {
            status: 429, statusText: 'Too Many Requests', headers, config: { headers }, data: {},
        });
    }

    it('para de chamar o Spotify depois do 429 e continua resolvendo pelo banco', async () => {
        const service = new SpotifyCatalogService(prisma as never);
        jest.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 't', expires_in: 3600 } });
        const get = jest.spyOn(axios, 'get').mockRejectedValue(tooManyRequests('9507'));
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        const first = await service.resolveSongs([{ title: 'One More Hour', artist: 'Tame Impala' }]);
        expect(first).toEqual([null]);
        expect(get).toHaveBeenCalledTimes(1); // uma tentativa, sem repetir
        expect(service.isBlocked()).toBe(true);

        const second = await service.resolveSongs([
            { title: 'Solidão', artist: 'Alceu Valença' },
            { title: 'Elephant', artist: 'Tame Impala' },
        ]);
        expect(get).toHaveBeenCalledTimes(1); // bloqueado: nenhuma chamada nova
        expect(second[0]).toBeNull();
        expect(second[1]?.spotifyId).toBe('id-conhecida'); // veio do banco
    });
});
