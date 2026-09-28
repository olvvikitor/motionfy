import { Injectable } from "@nestjs/common";
import { TrackEnrichmentService } from "src/shared/infra/IA/track-enrichment.service";
import { PlaylistRepository } from "../repository/playlist.repository";
import { matchesNational, NationalOption } from "./journey-filters";
import { JourneyCandidate, primaryArtist } from "./journey-path";

// Teto da fila em memória: o MusicBrainz aceita 1 chamada por segundo (e são até 2 por artista).
const MAX_PENDING = 500;

type ArtistSample = { title: string; artist: string; isrc?: string | null };

// País do artista principal de cada música, para o filtro de música nacional. Vem da tabela ArtistInfo
// (consultado uma vez por artista). Com o filtro ligado, artista sem país conhecido fica de fora da playlist;
// quem ainda não foi consultado entra numa fila em segundo plano (a playlist não espera o MusicBrainz) e passa
// a valer nas próximas. Os artistas antigos são preenchidos por `npm run backfill-artist-country`.
@Injectable()
export class ArtistCountryService {
    private readonly pending = new Map<string, ArtistSample>();
    private draining = false;

    constructor(
        private readonly repository: PlaylistRepository,
        private readonly enrichment: TrackEnrichmentService,
    ) { }

    // Preenche `artistCountry` nas candidatas que ainda não têm (null = consultado sem resposta; ausente =
    // nunca consultado, vai para a fila).
    async annotate(candidates: JourneyCandidate[]): Promise<void> {
        const todo = candidates.filter(c => c.artistCountry === undefined);
        const known = await this.lookup(todo.map(c => ({ title: c.title, artist: c.artist, isrc: c.isrc ?? null })));
        for (const c of todo) {
            const name = primaryArtist(c.artist);
            if (known.has(name)) c.artistCountry = known.get(name)!;
        }
    }

    // Só as músicas cujo artista tem país conhecido e passa na opção (antes da análise do Jev, para não gastar
    // com o que sairia depois).
    async keepMatching<T extends ArtistSample>(tracks: T[], option: NationalOption): Promise<T[]> {
        const known = await this.lookup(tracks);
        return tracks.filter(t => matchesNational(known.get(primaryArtist(t.artist)), option));
    }

    // País de cada artista já consultado (nome → país ou null); os nunca consultados vão para a fila.
    private async lookup(tracks: ArtistSample[]): Promise<Map<string, string | null>> {
        if (!tracks.length) return new Map();
        const known = await this.repository.getArtistCountries([...new Set(tracks.map(t => primaryArtist(t.artist)))]);
        for (const t of tracks) {
            const name = primaryArtist(t.artist);
            if (!known.has(name)) this.enqueue(name, { title: t.title, artist: t.artist, isrc: t.isrc ?? null });
        }
        return known;
    }

    private enqueue(name: string, sample: ArtistSample): void {
        if (this.pending.has(name) || this.pending.size >= MAX_PENDING) return;
        this.pending.set(name, sample);
        if (!this.draining) void this.drain();
    }

    // Um artista por vez (a fila do MusicBrainz já espaça as chamadas). Falha de rede: o artista sai da fila
    // sem gravar nada e volta na próxima playlist que o tiver.
    private async drain(): Promise<void> {
        this.draining = true;
        try {
            for (const [name, sample] of this.pending) {
                try {
                    const { country, source } = await this.enrichment.getArtistCountry({ ...sample, isrc: sample.isrc ?? null });
                    await this.repository.saveArtistCountry(name, country, source);
                } catch (error) {
                    console.error(`[ArtistCountry] não deu para consultar "${name}":`, error instanceof Error ? error.message : error);
                } finally {
                    this.pending.delete(name);
                }
            }
        } finally {
            this.draining = false;
        }
    }
}
