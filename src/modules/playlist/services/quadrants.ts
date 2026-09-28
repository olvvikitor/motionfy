import { getClusterVector } from "src/shared/infra/IA/emotion-analysis.service";
import { Vector } from "./journey-path";

// Os 4 quadrantes do mapa de humores (polaridade × ativação), com os mesmos humores do globo do app
// (front: MoodGlobe). Ambivalente fica no cruzamento dos eixos e não entra em nenhum.
// Playlist por quadrante: qualquer música de um desses humores serve, em vez de um humor só (um ponto
// no espaço 10D, onde poucas músicas caem perto).
export const QUADRANT_MOODS = {
    PositivoAtivo: ['Energia', 'Euforia', 'Confianca', 'Celebracao'],
    PositivoCalmo: ['Reflexao', 'Paz', 'Amor'],
    NegativoAtivo: ['Tensao', 'Revolta', 'Frustracao'],
    NegativoCalmo: ['Melancolia', 'Tristeza', 'Vazio'],
} as const satisfies Record<string, readonly string[]>;

export type Quadrant = keyof typeof QUADRANT_MOODS;
export const QUADRANTS = Object.keys(QUADRANT_MOODS) as Quadrant[];

export function inQuadrant(quadrant: Quadrant, sentiment: string): boolean {
    return (QUADRANT_MOODS[quadrant] as readonly string[]).includes(sentiment);
}

// Os humores do quadrante do mais calmo ao mais agitado (Energia do perfil): o caminho da playlist
// sobe aos poucos em vez de pular entre eles.
export function quadrantRoute(quadrant: Quadrant): { mood: string; vector: Vector }[] {
    return QUADRANT_MOODS[quadrant]
        .map(mood => ({ mood, vector: getClusterVector(mood)! as Vector }))
        .sort((a, b) => a.vector.Energia - b.vector.Energia);
}
