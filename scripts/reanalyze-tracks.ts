// Reanalisa pelo Jev as faixas já analisadas (depois de mudar o que vai no prompt ou o enriquecimento).
// Uso: npm run reanalyze -- [--before=2026-09-26T12:00:00Z] [--limit=50]
// Só refaz análises com `analyzedAt` anterior ao corte (padrão: agora). Cada faixa refeita ganha
// `analyzedAt` novo, então rodar de novo com o mesmo `--before` continua de onde parou.
import 'dotenv/config';
import { PrismaService } from '../src/config/prisma.service';
import { AiTextService } from '../src/shared/infra/IA/AiText.service';
import { EmotionAnalysisService } from '../src/shared/infra/IA/emotion-analysis.service';
import { TrackEnrichmentService } from '../src/shared/infra/IA/track-enrichment.service';

const BATCH = 20;
const CONCURRENCY = 4; // o MusicBrainz (1 req/s) já serializa a parte dele

function arg(name: string): string | undefined {
    return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
    const before = new Date(arg('before') ?? Date.now());
    const limit = arg('limit') ? Number(arg('limit')) : Infinity;
    const prisma = new PrismaService();
    const ai = new AiTextService(new EmotionAnalysisService(), new TrackEnrichmentService());

    const total = await prisma.tracksAnalysis.count({ where: { analyzedAt: { lt: before } } });
    console.log(`Corte: ${before.toISOString()} · ${total} faixa(s) para reanalisar${Number.isFinite(limit) ? ` (limite ${limit})` : ''}`);

    let done = 0, failed = 0, changed = 0;
    const skipped = new Set<string>(); // falhou nesta rodada: não tenta de novo em loop

    while (done + failed < limit) {
        const rows = await prisma.tracksAnalysis.findMany({
            where: { analyzedAt: { lt: before }, spotifyid: { notIn: [...skipped] } },
            orderBy: { analyzedAt: 'asc' },
            take: Math.min(BATCH, limit - done - failed),
            select: { spotifyid: true, dominantSentiment: true },
        });
        if (!rows.length) break;

        const tracks = await prisma.track.findMany({
            where: { spotifyId: { in: rows.map(r => r.spotifyid) } },
            select: { id: true, spotifyId: true, title: true, artist: true, album: true, img_url: true, isrc: true, explicit: true, releaseDate: true },
        });
        const trackById = new Map(tracks.map(t => [t.spotifyId, t]));

        for (let i = 0; i < rows.length; i += CONCURRENCY) {
            await Promise.all(rows.slice(i, i + CONCURRENCY).map(async row => {
                const track = trackById.get(row.spotifyid);
                try {
                    if (!track) throw new Error('faixa sem registro em Track');
                    const a = await ai.analyzeTrack(track);
                    await prisma.tracksAnalysis.update({
                        where: { spotifyid: row.spotifyid },
                        data: {
                            moodScore: a.moodScore,
                            dominantSentiment: a.dominantSentiment,
                            coreAxes: a.coreAxes as any,
                            emotionalVector: a.emotionalVector as any,
                            reasoning: a.reasoning,
                            genre: a.genre,
                            subgenre: a.subgenre,
                            analyzedAt: new Date(),
                        },
                    });
                    done++;
                    if (a.dominantSentiment !== row.dominantSentiment) changed++;
                } catch (error: any) {
                    failed++;
                    skipped.add(row.spotifyid);
                    console.error(`✗ ${track?.title ?? row.spotifyid}: ${error?.message ?? error}`);
                }
            }));
        }
        console.log(`${done + failed}/${Math.min(total, limit)} · ok ${done} · falhas ${failed} · humor mudou em ${changed}`);
    }

    console.log(`Fim: ${done} reanalisada(s), ${failed} falha(s), humor dominante mudou em ${changed}.`);
    await prisma.$disconnect();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
