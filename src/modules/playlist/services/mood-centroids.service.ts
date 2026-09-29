import { Injectable } from "@nestjs/common";
import { EMOTION_CLUSTERS, getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { PlaylistRepository } from "../repository/playlist.repository";
import { Vector } from "./journey-path";
import { learnCentroids } from "./mood-centroids";

// O acervo muda devagar: recalcula no máximo a cada 6 h.
const REFRESH_MS = 6 * 3_600_000;

// Centros dos humores aprendidos do acervo (mood-centroids.ts), guardados em memória.
@Injectable()
export class MoodCentroidsService {
    private cached: { clusters: Record<string, Vector>; at: number } | null = null;
    private loading: Promise<Record<string, Vector>> | null = null;

    constructor(private readonly repository: PlaylistRepository) { }

    async clusters(): Promise<Record<string, Vector>> {
        if (this.cached && Date.now() - this.cached.at < REFRESH_MS) return this.cached.clusters;
        this.loading ??= this.load().finally(() => { this.loading = null; });
        return this.loading;
    }

    async vector(label: string): Promise<Vector | undefined> {
        return (await this.clusters())[label];
    }

    private async load(): Promise<Record<string, Vector>> {
        const prior = Object.fromEntries(EMOTION_CLUSTERS.map(label => [label, getClusterVector(label)! as Vector]));
        try {
            const clusters = learnCentroids(await this.repository.getMoodVectors(), prior);
            this.cached = { clusters, at: Date.now() };
            return clusters;
        } catch (error) {
            console.error('[MoodCentroids] falha ao aprender os centros, usando os perfis:', (error as Error)?.message ?? error);
            return this.cached?.clusters ?? prior;
        }
    }
}
