import { Injectable } from '@nestjs/common';

export type CoreAxes = {
    polaridade: number;
    ativacao: number;
    quadrante: string;
};

export type SentimentResult = {
    label: string;
    score: number;
};

export const EMOTIONAL_DIMENSIONS = [
    "Valencia",
    "Energia",
    "Dominancia",
    "Melancolia",
    "Euforia",
    "Tensao",
    "ConexaoSocial",
    "Introspeccao",
    "Empoderamento",
    "Vulnerabilidade"
] as const;

export type EmotionalVector = {
    [K in typeof EMOTIONAL_DIMENSIONS[number]]: number;
};

export type EmotionClassification = {
    dominantSentiment: string;
    moodScore: number;
    coreAxes: CoreAxes;
    emotionProbabilities: { label: string; probability: number }[];
};

const CLUSTER_POSITIONS: Record<string, { x: number; y: number }> = {
  // --- QUADRANTE: POSITIVO / ATIVO (Energia Alta, Humor Bom) ---
  EuforiaAtiva:         { x: 0.85, y: 0.80 }, // Festa, Êxtase
  ConfiancaDominante:   { x: 0.60, y: 0.60 }, // Empoderamento, Rock motivacional
  
  // --- QUADRANTE: POSITIVO / CALMO (Energia Baixa, Humor Bom) ---
  ConexaoAfetiva:       { x: 0.80, y: 0.10 }, // Amor, Amizade, Calor humano (mais social)
  Serenidade:           { x: 0.70, y: -0.60 }, // Relaxamento, Natureza, Meditação
  Contemplacao:         { x: 0.20, y: -0.85 }, // Filosofia, Psicodelia, "Viajar" (MUITO calmo)

  // --- QUADRANTE: NEGATIVO / CALMO (Energia Baixa, Humor Ruim) ---
  NostalgiaProfunda:    { x: -0.40, y: -0.50 }, // Saudade, Melancolia "doce"
  Desanimo:             { x: -0.85, y: -0.70 }, // Tristeza profunda, Apatia

  // --- QUADRANTE: NEGATIVO / ATIVO (Energia Alta, Humor Ruim) ---
  IrritacaoAtiva:       { x: -0.50, y: 0.60 }, // Ansiedade, Tensão, Nervosismo
  RaivaExplosiva:       { x: -0.90, y: 0.90 }, // Agressividade, Metal pesado, Grito

  // --- ESTADO DE TRANSIÇÃO (Centro-Esquerda) ---
  VulnerabilidadeEmocional: { x: -0.15, y: -0.20 }, // Incerteza, Fragilidade, Introspecção crua
};

@Injectable()
export class EmotionAnalysisService {

    private clamp(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

    private normalize(value: number): number {
        return (value * 2) - 1;
    }

    private euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    }

    private softmax(values: number[]): number[] {
        const exp = values.map(v => Math.exp(v));
        const sum = exp.reduce((a, b) => a + b, 0);
        return exp.map(v => v / sum);
    }

    calculateCoreAxes(vector: EmotionalVector): CoreAxes {
        const polaridade = this.normalize(vector.Valencia);

        const ativacao = this.normalize(
            this.clamp(vector.Energia * 0.6 + vector.Tensao * 0.4)
        );

        const quadrante = this.classifyQuadrant(polaridade, ativacao);

        return { polaridade, ativacao, quadrante };
    }

    classifyQuadrant(p: number, a: number): string {
        if (p >= 0 && a >= 0) return "PositivoAtivo";
        if (p >= 0 && a < 0) return "PositivoCalmo";
        if (p < 0 && a >= 0) return "NegativoAtivo";
        return "NegativoCalmo";
    }

    classifyEmotion(vector: EmotionalVector): EmotionClassification {
        const coreAxes = this.calculateCoreAxes(vector);
        const { polaridade, ativacao } = coreAxes;

        const distances = Object.entries(CLUSTER_POSITIONS).map(([label, position]) => ({
            label,
            distance: this.euclideanDistance(polaridade, ativacao, position.x, position.y),
        }));

        const similarities = distances.map(d => Math.pow(1 / (d.distance + 0.001), 4));
        const probabilities = this.softmax(similarities);

        const emotionProbabilities = distances
            .map((d, i) => ({ label: d.label, probability: probabilities[i] }))
            .sort((a, b) => b.probability - a.probability);

        const dominant = emotionProbabilities[0];

        return {
            dominantSentiment: dominant.label,
            moodScore: dominant.probability,
            coreAxes,
            emotionProbabilities,
        };
    }

    buildFallbackVector(): EmotionalVector {
        return Object.fromEntries(
            EMOTIONAL_DIMENSIONS.map(d => [d, 0.5])
        ) as EmotionalVector;
    }
}