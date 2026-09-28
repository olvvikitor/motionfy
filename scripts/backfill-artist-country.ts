// Preenche o país dos artistas (ArtistInfo) das faixas já analisadas, para o filtro de música nacional.
// Uso: npm run backfill-artist-country -- [--limit=500]
// Um artista por vez (MusicBrainz: 1 chamada por segundo, até 2 por artista; sem país lá, tags do Last.fm).
// Pula os já consultados: rodar de novo continua de onde parou. Falha de rede não grava (tenta na próxima rodada).
import 'dotenv/config';
import { PrismaService } from '../src/config/prisma.service';
import { TrackEnrichmentService } from '../src/shared/infra/IA/track-enrichment.service';

const BATCH = 500;

const primaryArtist = (artist: string) => artist.split(', ')[0].trim().toLowerCase();

function arg(name: string): string | undefined {
    return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
    const limit = arg('limit') ? Number(arg('limit')) : Infinity;
    const prisma = new PrismaService();
    const enrichment = new TrackEnrichmentService();

    // Um exemplo de faixa por artista principal (com ISRC quando houver: acha o artista certo no MusicBrainz).
    const samples = new Map<string, { title: string; artist: string; isrc: string | null }>();
    for (let skip = 0; ; skip += BATCH) {
        const analyses = await prisma.tracksAnalysis.findMany({ select: { spotifyid: true }, orderBy: { id: 'asc' }, skip, take: BATCH });
        if (!analyses.length) break;
        const tracks = await prisma.track.findMany({
            where: { spotifyId: { in: analyses.map(a => a.spotifyid) } },
            select: { title: true, artist: true, isrc: true },
        });
        for (const track of tracks) {
            const name = primaryArtist(track.artist);
            const current = samples.get(name);
            if (name && (!current || (!current.isrc && track.isrc))) samples.set(name, track);
        }
    }

    const done = new Set((await prisma.artistInfo.findMany({ select: { name: true } })).map(r => r.name));
    const todo = [...samples.keys()].filter(name => !done.has(name)).slice(0, Number.isFinite(limit) ? limit : undefined);
    console.log(`${samples.size} artista(s), ${done.size} já consultado(s), ${todo.length} nesta rodada`);

    const counts = { br: 0, other: 0, none: 0, failed: 0 };
    for (const [i, name] of todo.entries()) {
        try {
            const { country, source } = await enrichment.getArtistCountry(samples.get(name)!);
            await prisma.artistInfo.upsert({
                where: { name },
                create: { name, country, source },
                update: { country, source, checkedAt: new Date() },
            });
            if (!country) counts.none++; else if (country === 'BR') counts.br++; else counts.other++;
        } catch (error) {
            counts.failed++;
            console.error(`falhou "${name}":`, error instanceof Error ? error.message : error);
        }
        if ((i + 1) % 25 === 0) console.log(`${i + 1}/${todo.length} · BR ${counts.br} · outros ${counts.other} · sem país ${counts.none} · falhas ${counts.failed}`);
    }

    console.log(`Fim: BR ${counts.br}, outros países ${counts.other}, sem país ${counts.none}, falhas ${counts.failed}.`);
    await prisma.$disconnect();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
