// Preenche o BPM (Deezer) das faixas já analisadas que ainda não têm, sem chamar o Jev.
// Uso: npm run backfill-bpm -- [--limit=500]
// Faixa que o Deezer não conhece fica com bpm null e é pulada nesta rodada; rodar de novo tenta outra vez.
import 'dotenv/config';
import { PrismaService } from '../src/config/prisma.service';
import { TrackEnrichmentService } from '../src/shared/infra/IA/track-enrichment.service';

const BATCH = 50;
const CONCURRENCY = 5;

function arg(name: string): string | undefined {
    return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
    const limit = arg('limit') ? Number(arg('limit')) : Infinity;
    const prisma = new PrismaService();
    const enrichment = new TrackEnrichmentService();

    const total = await prisma.tracksAnalysis.count({ where: { bpm: null } });
    console.log(`${total} faixa(s) sem BPM${Number.isFinite(limit) ? ` (limite ${limit})` : ''}`);

    let found = 0, missing = 0;
    const tried = new Set<string>();

    while (found + missing < limit) {
        const rows = await prisma.tracksAnalysis.findMany({
            where: { bpm: null, spotifyid: { notIn: [...tried] } },
            take: Math.min(BATCH, limit - found - missing),
            select: { spotifyid: true },
        });
        if (!rows.length) break;
        rows.forEach(r => tried.add(r.spotifyid));

        const tracks = await prisma.track.findMany({
            where: { spotifyId: { in: rows.map(r => r.spotifyid) } },
            select: { spotifyId: true, title: true, artist: true, isrc: true },
        });

        for (let i = 0; i < tracks.length; i += CONCURRENCY) {
            await Promise.all(tracks.slice(i, i + CONCURRENCY).map(async track => {
                const bpm = await enrichment.getBpm(track);
                if (bpm === null) { missing++; return; }
                await prisma.tracksAnalysis.update({ where: { spotifyid: track.spotifyId! }, data: { bpm } });
                found++;
            }));
        }
        missing += rows.length - tracks.length; // análise sem registro em Track
        console.log(`${found + missing}/${Math.min(total, limit)} · com BPM ${found} · sem ${missing}`);
    }

    console.log(`Fim: ${found} com BPM, ${missing} sem (o Deezer não conhece).`);
    await prisma.$disconnect();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
