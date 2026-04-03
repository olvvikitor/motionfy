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
// 19 clusters cobrindo todo o espaço emocional.
//
//   POSITIVO/ATIVO (+p, +a)
//     EuforiaAtiva       ( 0.85,  0.80)  Festa, EDM, pop eufórico
//     ConfiancaDominante ( 0.55,  0.55)  Rock motivacional, empoderamento
//     RockEletrizante    ( 0.35,  0.90)  Alta energia, valência neutra-positiva
//     TensaoCriativa     ( 0.10,  0.75)  Rock enérgico sem alegria clara
//
//   POSITIVO/CALMO (+p, -a)
//     AmorCalmo          ( 0.90, -0.20)  Bossa nova, love songs suaves
//     ConexaoAfetiva     ( 0.75,  0.10)  Amor, amizade, calor humano
//     NostalgiaFeliz     ( 0.40, -0.35)  Saudade boa, "aquela época"
//     Serenidade         ( 0.65, -0.60)  Relaxamento, natureza, ambient
//     PazInterior        ( 0.50, -0.85)  Meditação, folk minimalista
//     Contemplacao       ( 0.20, -0.85)  Filosofia, psicodelia, existencialismo
//
//   NEGATIVO/ATIVO (-p, +a)
//     TensaoDramatica    (-0.10,  0.90)  Angústia intensa, post-rock tenso
//     Frustracao         (-0.25,  0.30)  Frustração contida, pós-punk
//     IrritacaoAtiva     (-0.50,  0.60)  Ansiedade, tensão, nervosismo
//     RaivaExplosiva     (-0.90,  0.90)  Metal pesado, hardcore
//
//   NEGATIVO/CALMO (-p, -a)
//     NostalgiaProfunda  (-0.40, -0.50)  Saudade dolorosa, melancolia "doce"
//     Desanimo           (-0.85, -0.70)  Tristeza profunda, apatia, derrota
//
//   CENTRO / TRANSIÇÃO
//     VulnerabilidadeEmocional (-0.15, -0.20)  Fragilidade, introspecção crua
//     Ambivalencia             ( 0.05,  0.10)  Indie ambíguo, emoção difusa
//     Estupor                  (-0.60,  0.15)  Entorpecimento, blues lento
// ---------------------------------------------------------------------------
const CLUSTER_POSITIONS = {

    // ── POSITIVO / ATIVO ─────────────────────────────────────
    Euforia: { x: 0.85, y: 0.85, sigma: 0.30 },
    Confianca: { x: 0.50, y: 0.50, sigma: 0.30 },
    Energia: { x: 0.20, y: 0.85, sigma: 0.30 },

    // ── POSITIVO / CALMO ─────────────────────────────────────
    Amor: { x: 0.85, y: -0.20, sigma: 0.30 },
    Paz: { x: 0.60, y: -0.75, sigma: 0.30 },
    Reflexao: { x: 0.25, y: -0.50, sigma: 0.30 },

    // ── NEGATIVO / ATIVO ─────────────────────────────────────
    Tensao: { x: -0.30, y: 0.80, sigma: 0.30 },
    Revolta: { x: -0.85, y: 0.85, sigma: 0.30 },
    Frustracao: { x: -0.60, y: 0.40, sigma: 0.30 },

    // ── NEGATIVO / CALMO ─────────────────────────────────────
    Melancolia: { x: -0.35, y: -0.45, sigma: 0.30 },
    Tristeza: { x: -0.85, y: -0.75, sigma: 0.30 },
    Vazio: { x: -0.70, y: -0.20, sigma: 0.30 },

    // ── CENTRO / TRANSIÇÃO ───────────────────────────────────
    Ambivalente: { x: 0.00, y: 0.00, sigma: 0.20 },
};

@Injectable()
export class EmotionAnalysisService {
    private static readonly ACTIVATION_MIN = -0.25;
    private static readonly ACTIVATION_MAX = 1.0;

    private clamp(value: number, min = 0, max = 1): number {
        return Math.max(min, Math.min(max, value));
    }

    private clampDimensionValue(value: unknown): number {
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
            return 0.5;
        }

        return this.clamp(value, 0, 1);
    }

    private sanitizeVector(vector: EmotionalVector): EmotionalVector {
        return Object.fromEntries(
            EMOTIONAL_DIMENSIONS.map((dimension) => [dimension, this.clampDimensionValue(vector[dimension])])
        ) as EmotionalVector;
    }

    private normalize(value: number): number {
        return (value * 2) - 1; // [0,1] → [-1,+1]
    }

    private euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    }

    // RBF kernel: k(d, σ) = exp(−d² / (2σ²))
    private rbfSimilarity(distance: number, sigma: number): number {
        return Math.exp(-(distance * distance) / (2 * sigma * sigma));
    }

    // Ambivalência deve dominar apenas quando o ponto está realmente próximo do centro.
    private calibrateAmbivalenciaAffinity(polaridade: number, ativacao: number, affinity: number): number {
        const radialDistance = Math.sqrt((polaridade * polaridade) + (ativacao * ativacao));

        if (radialDistance > 0.35) return affinity * 0.25;
        if (radialDistance > 0.25) return affinity * 0.50;
        if (radialDistance < 0.12) return affinity * 1.25;

        return affinity;
    }

    // Softmax com estabilidade numérica
    private softmax(values: number[]): number[] {
        const max = Math.max(...values);
        const exp = values.map(v => Math.exp(v - max));
        const sum = exp.reduce((a, b) => a + b, 0);
        return exp.map(v => v / sum);
    }

    // -------------------------------------------------------------------------
    // Sigmoid comprimida para mapear polaridade → moodScore em [0.10, 0.90]
    //
    // Por que sigmoid aqui?
    //   O mapeamento linear (polaridade + 1) / 2 produz scores acima de 85%
    //   para músicas normalmente positivas (Valencia ≥ 0.75), que é a maioria.
    //   A sigmoid "encolhe" os extremos — músicas muito positivas chegam a ~82%
    //   em vez de 92%, e músicas muito negativas caem a ~18% em vez de 5%.
    //   Isso evita que qualquer análise pareça "perfeita" ou "catastrófica".
    //
    // Parâmetros:
    //   k = 2.5  → inclinação moderada (3.0+ seria muito íngreme)
    //   min/max  → comprime a saída para [0.10, 0.90] deliberadamente:
    //              nenhum dia é 100% eufórico ou 0% funcional.
    // -------------------------------------------------------------------------
    private polaridadeToMoodScore(polaridade: number): number {
        const k = 2.5;
        const raw = 1 / (1 + Math.exp(-k * polaridade)); // sigmoid em [0,1]
        // Re-escala de [0,1] para [0.10, 0.90]
        return 0.10 + raw * 0.80;
    }

    // -------------------------------------------------------------------------
    // Cálculo do eixo de ativação — revisado
    //
    // Problema anterior:
    //   rawAtivacao = Energia * 0.45 + Tensao * 0.30 + Euforia * 0.15 - Melancolia * 0.10
    //   → Tensao pesava demais (0.30), elevando a ativação de músicas tensas mas lentas.
    //   → Dominancia era ignorada (músicas dominantes são tipicamente ativas).
    //   → Euforia pesava pouco (0.15) mesmo sendo amplificador primário de ativação.
    //
    // Revisão dos pesos:
    //   Energia      0.50 → principal driver fisiológico (BPM, volume, drive)
    //   Euforia      0.25 → amplificador emocional de ativação percebida
    //   Dominancia   0.15 → músicas dominantes tendem a ter mais presença/energia
    //   Tensao       0.10 → contribui mas não domina (tensão ≠ energia)
    //   Melancolia  -0.15 → suprime ativamente (músicas melancólicas são passivas)
    //   Vulnerab.   -0.10 → introspecção reduz ativação percebida
    //
    // Soma dos pesos positivos = 0.90, negativos = -0.25
    // Antes de normalizar, o raw pode cair em ~[-0.25, 0.90] dependendo do vetor.
    // Aplicamos clamp e depois normalize para mapear para [-1, +1].
    // -------------------------------------------------------------------------
    calculateCoreAxes(vector: EmotionalVector): CoreAxes {
        const safeVector = this.sanitizeVector(vector);

        // Polaridade (Eixo X): O eixo hedônico
        // Adotando Math.max para permitir que Empoderamento muito alto 
        // interceda pela Valência caso a música seja séria/focada (ex: Rap).
        let rawPolaridade =
            Math.max(safeVector.Valencia, safeVector.Empoderamento * 0.8) * 0.50 +
            safeVector.Dominancia * 0.20 +
            safeVector.Empoderamento * 0.15 +
            safeVector.ConexaoSocial * 0.15 -
            safeVector.Melancolia * 0.20 -
            safeVector.Tensao * 0.15 -
            safeVector.Vulnerabilidade * 0.15;

        // HARD OVERRIDE PARA RAP/TRAP FOCADOS
        // Se há altíssima dominância e empoderamento (ego elevado/confiança forte), 
        // a polaridade real NUNCA pode ser negativa (o que forçaria para 'Frustração' ou 'Tensão'), 
        // contornando o peso alto da 'Tensão' de letras sérias.
        if (safeVector.Dominancia >= 0.7 && safeVector.Empoderamento >= 0.7) {
            rawPolaridade = Math.max(rawPolaridade, 0.65);
            // 0.65 resulta em +0.3 após normalizar, o que direciona para Confianca ou Energia.
        }

        const polaridade = this.normalize(this.clamp(rawPolaridade));

        // Ativação (Eixo Y): O Eixo de energia fisiológica/mental
        const rawAtivacao =
            Math.max(safeVector.Energia, safeVector.Dominancia * 0.8) * 0.45 +
            safeVector.Euforia * 0.20 +
            safeVector.Tensao * 0.15 +
            safeVector.Dominancia * 0.20 -
            safeVector.Melancolia * 0.20 -
            safeVector.Vulnerabilidade * 0.15;

        const rawAtivacaoScaled =
            (rawAtivacao - EmotionAnalysisService.ACTIVATION_MIN) /
            (EmotionAnalysisService.ACTIVATION_MAX - EmotionAnalysisService.ACTIVATION_MIN);

        const ativacao = this.normalize(this.clamp(rawAtivacaoScaled));
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
        const coreAxes = this.calculateCoreAxes(this.sanitizeVector(vector));
        const { polaridade, ativacao } = coreAxes;

        // 1. Afinidade RBF para cada cluster
        const entries = Object.entries(CLUSTER_POSITIONS);
        const affinities = entries.map(([label, cluster]) => {
            const distance = this.euclideanDistance(polaridade, ativacao, cluster.x, cluster.y);
            let affinity = this.rbfSimilarity(distance, cluster.sigma);

            if (label === 'Ambivalencia') {
                affinity = this.calibrateAmbivalenciaAffinity(polaridade, ativacao, affinity);
            }

            return { label, affinity };
        });

        // 2. Softmax sobre afinidades → probabilidades comparáveis
        const affinityValues = affinities.map(a => a.affinity);
        const probabilities = this.softmax(affinityValues);

        const emotionProbabilities = affinities
            .map((a, i) => ({ label: a.label, probability: probabilities[i] }))
            .sort((a, b) => b.probability - a.probability);

        const dominant = emotionProbabilities[0];

        // 3. moodScore via sigmoid comprimida para [0.10, 0.90]
        //    Evita extremos absolutos — nenhum dia é 100% perfeito ou 0% funcional.
        const moodScore = this.polaridadeToMoodScore(polaridade);

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
