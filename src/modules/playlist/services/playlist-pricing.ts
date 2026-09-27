// Durações da playlist e o custo de cada uma em créditos. Até 45 min é grátis; acima, cobra por geração
// (o que é caro: mais paradas, mais busca e classificação no Jev). O front espelha esta tabela (playlistService.ts).
export const PLAYLIST_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

const DURATION_COST: Record<number, number> = { 60: 0.3, 90: 0.5, 120: 0.75 };

export function durationCost(durationMin: number): number {
    return DURATION_COST[durationMin] ?? 0;
}
