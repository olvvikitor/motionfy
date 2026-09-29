// ---------------------------------------------------------------------------
// Centro de cada humor no espaço 10D, aprendido das músicas já analisadas. Função pura.
// Os perfis escritos à mão (emotion-analysis.service) não batem com onde o Jev põe as músicas: só 2%
// das "Amor" ficavam a até FIT_RADIUS do centro de Amor, e a playlist de um humor enchia de vizinhos.
// Centro = mediana de cada dimensão das músicas do humor, puxada para o perfil à mão quando há
// poucas (peso n / (n + PRIOR_WEIGHT)).
// ---------------------------------------------------------------------------
import { Vector } from "./journey-path";

export const PRIOR_WEIGHT = 10;

export function learnCentroids(
    rows: { vector: Vector; sentiment: string }[],
    prior: Record<string, Vector>,
): Record<string, Vector> {
    return Object.fromEntries(Object.entries(prior).map(([label, base]) => {
        const own = rows.filter(r => r.sentiment === label);
        const share = own.length / (own.length + PRIOR_WEIGHT);
        return [label, Object.fromEntries(Object.keys(base).map(dim => {
            const learned = own.length ? median(own.map(r => r.vector[dim] ?? base[dim])) : base[dim];
            return [dim, base[dim] + (learned - base[dim]) * share];
        }))];
    }));
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
