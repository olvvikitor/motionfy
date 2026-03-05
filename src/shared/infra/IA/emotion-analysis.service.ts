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

// ---------------------------------------------------------------------------
// CLUSTER MAP  (polaridade × ativacao, ambos em [-1, +1])
//
// 18 clusters cobrindo todo o espaço emocional.
// Novos clusters marcados com ← NOVO
//
//   POSITIVO/ATIVO (+p, +a)
//     EuforiaAtiva       ( 0.85,  0.80)  Festa, EDM, pop eufórico
//     ConfiancaDominante ( 0.55,  0.55)  Rock motivacional, empoderamento
//     RockEletrizante    ( 0.35,  0.90)  ← NOVO  Alta energia, valência neutra-positiva
//     TensaoCriativa     ( 0.10,  0.75)  ← NOVO  Rock enérgico sem alegria clara
//
//   POSITIVO/CALMO (+p, -a)
//     AmorCalmo          ( 0.90, -0.20)  ← NOVO  Bossa nova, love songs suaves
//     ConexaoAfetiva     ( 0.75,  0.10)  Amor, amizade, calor humano
//     NostalgiaFeliz     ( 0.40, -0.35)  ← NOVO  Saudade boa, "aquela época"
//     Serenidade         ( 0.65, -0.60)  Relaxamento, natureza, ambient
//     PazInterior        ( 0.50, -0.85)  ← NOVO  Meditação, folk minimalista
//     Contemplacao       ( 0.20, -0.85)  Filosofia, psicodelia, existencialismo
//
//   NEGATIVO/ATIVO (-p, +a)
//     TensaoDramatica    (-0.10,  0.90)  ← NOVO  Angústia intensa, post-rock tenso
//     Frustracao         (-0.25,  0.30)  ← NOVO  Frustração contida, pós-punk
//     IrritacaoAtiva     (-0.50,  0.60)  Ansiedade, tensão, nervosismo
//     RaivaExplosiva     (-0.90,  0.90)  Metal pesado, hardcore
//
//   NEGATIVO/CALMO (-p, -a)
//     NostalgiaProfunda  (-0.40, -0.50)  Saudade dolorosa, melancolia "doce"
//     Desanimo           (-0.85, -0.70)  Tristeza profunda, apatia, derrota
//
//   CENTRO / TRANSIÇÃO
//     VulnerabilidadeEmocional (-0.15, -0.20)  Fragilidade, introspecção crua
//     Ambivalencia             ( 0.05,  0.10)  ← NOVO  Indie ambíguo, emoção difusa
//     Estupor                  (-0.60,  0.15)  ← NOVO  Entorpecimento, blues lento
// ---------------------------------------------------------------------------

const CLUSTER_POSITIONS: Record<string, { x: number; y: number; sigma: number }> = {

  // ── POSITIVO / ATIVO ──────────────────────────────────────────────────────
  EuforiaAtiva:             { x:  0.85, y:  0.80, sigma: 0.32 },
  ConfiancaDominante:       { x:  0.55, y:  0.55, sigma: 0.38 },
  RockEletrizante:          { x:  0.35, y:  0.90, sigma: 0.30 }, // ← NOVO
  TensaoCriativa:           { x:  0.10, y:  0.75, sigma: 0.36 }, // ← NOVO

  // ── POSITIVO / CALMO ──────────────────────────────────────────────────────
  AmorCalmo:                { x:  0.90, y: -0.20, sigma: 0.35 }, // ← NOVO
  ConexaoAfetiva:           { x:  0.75, y:  0.10, sigma: 0.38 },
  NostalgiaFeliz:           { x:  0.40, y: -0.35, sigma: 0.40 }, // ← NOVO
  Serenidade:               { x:  0.65, y: -0.60, sigma: 0.33 },
  PazInterior:              { x:  0.50, y: -0.85, sigma: 0.32 }, // ← NOVO
  Contemplacao:             { x:  0.20, y: -0.85, sigma: 0.28 },

  // ── NEGATIVO / ATIVO ──────────────────────────────────────────────────────
  TensaoDramatica:          { x: -0.10, y:  0.90, sigma: 0.30 }, // ← NOVO
  Frustracao:               { x: -0.25, y:  0.30, sigma: 0.38 }, // ← NOVO
  IrritacaoAtiva:           { x: -0.50, y:  0.60, sigma: 0.38 },
  RaivaExplosiva:           { x: -0.90, y:  0.90, sigma: 0.28 },

  // ── NEGATIVO / CALMO ──────────────────────────────────────────────────────
  NostalgiaProfunda:        { x: -0.40, y: -0.50, sigma: 0.38 },
  Desanimo:                 { x: -0.85, y: -0.70, sigma: 0.33 },

  // ── CENTRO / TRANSIÇÃO ────────────────────────────────────────────────────
  VulnerabilidadeEmocional: { x: -0.15, y: -0.20, sigma: 0.45 },
  Ambivalencia:             { x:  0.05, y:  0.10, sigma: 0.42 }, // ← NOVO
  Estupor:                  { x: -0.60, y:  0.15, sigma: 0.38 }, // ← NOVO
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

    // RBF kernel: k(d, σ) = exp(−d² / (2σ²))
    // Saída em [0,1], gradiente suave — pequenas variações no vetor
    // causam pequenas variações na classificação.
    private rbfSimilarity(distance: number, sigma: number): number {
        return Math.exp(-(distance * distance) / (2 * sigma * sigma));
    }

    // Softmax com estabilidade numérica (subtrai o máximo antes)
    private softmax(values: number[]): number[] {
        const max = Math.max(...values);
        const exp = values.map(v => Math.exp(v - max));
        const sum = exp.reduce((a, b) => a + b, 0);
        return exp.map(v => v / sum);
    }

    calculateCoreAxes(vector: EmotionalVector): CoreAxes {
        // polaridade: Valencia é o eixo hedônico direto
        const polaridade = this.normalize(vector.Valencia);

        // ativacao: composição fisiológica
        //   Energia    → arousal positivo (BPM, intensidade sonora)
        //   Tensao     → arousal negativo (stress, dissonância)
        //   Euforia    → amplifica ativação quando positiva
        //   Melancolia → suprime ativação (estados passivos/contemplativos)
        const rawAtivacao =
            vector.Energia    * 0.45 +
            vector.Tensao     * 0.30 +
            vector.Euforia    * 0.15 -
            vector.Melancolia * 0.10;

        const ativacao = this.normalize(this.clamp(rawAtivacao));
        const quadrante = this.classifyQuadrant(polaridade, ativacao);

        return { polaridade, ativacao, quadrante };
    }

    classifyQuadrant(p: number, a: number): string {
        if (p >= 0 && a >= 0) return "PositivoAtivo";
        if (p >= 0 && a <  0) return "PositivoCalmo";
        if (p <  0 && a >= 0) return "NegativoAtivo";
        return "NegativoCalmo";
    }

    classifyEmotion(vector: EmotionalVector): EmotionClassification {
        const coreAxes = this.calculateCoreAxes(vector);
        const { polaridade, ativacao } = coreAxes;

        // 1. Afinidade RBF para cada cluster
        const entries = Object.entries(CLUSTER_POSITIONS);
        const affinities = entries.map(([label, cluster]) => {
            const distance = this.euclideanDistance(polaridade, ativacao, cluster.x, cluster.y);
            const affinity = this.rbfSimilarity(distance, cluster.sigma);
            return { label, affinity };
        });

        // 2. Softmax sobre afinidades → probabilidades comparáveis
        const affinityValues = affinities.map(a => a.affinity);
        const probabilities = this.softmax(affinityValues);

        const emotionProbabilities = affinities
            .map((a, i) => ({ label: a.label, probability: probabilities[i] }))
            .sort((a, b) => b.probability - a.probability);

        const dominant = emotionProbabilities[0];

        // 3. moodScore = quão positivo é o humor em [0, 1]
        //    Semântica direta: 0 = desespero, 0.5 = neutro, 1 = euforia pura
        const moodScore = (polaridade + 1) / 2;

        return {
            dominantSentiment: dominant.label,
            moodScore,
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