import { Injectable } from '@nestjs/common';

export const EMOTIONAL_DIMENSIONS = [
    'Valencia',
    'Energia',
    'Dominancia',
    'Melancolia',
    'Euforia',
    'Tensao',
    'ConexaoSocial',
    'Introspeccao',
    'Empoderamento',
    'Vulnerabilidade',
] as const;

export type EmotionalVector = Record<typeof EMOTIONAL_DIMENSIONS[number], number>;

export type CoreAxes = {
    polaridade: number;
    ativacao: number;
    quadrante: string;
    [key: string]: any;
};

export interface EmotionClassification {
    dominantSentiment: string;
    moodScore: number;
    coreAxes: CoreAxes;
    emotionProbabilities: Array<{
        label: string;
        probability: number;
    }>;
}

// ---------------------------------------------------------------------------
// MAPA 10D: Perfis Ideais (Centróides)
// Em vez de esmagar o vetor para 2D, agora comparamos a música diretamente
// no espaço de 10 dimensões contra esses perfis ideais.
// ---------------------------------------------------------------------------
const CLUSTER_PROFILES_10D: Record<string, { vector: EmotionalVector, sigma: number }> = {
    Euforia: {
        vector: { Valencia: 0.8, Energia: 0.95, Dominancia: 0.8, Melancolia: 0.0, Euforia: 0.95, Tensao: 0.2, ConexaoSocial: 0.2, Introspeccao: 0.0, Empoderamento: 0.8, Vulnerabilidade: 0.0 },
        sigma: 0.6
    },
    Celebracao: {
        vector: { Valencia: 0.9, Energia: 0.8, Dominancia: 0.5, Melancolia: 0.1, Euforia: 0.7, Tensao: 0.1, ConexaoSocial: 0.95, Introspeccao: 0.1, Empoderamento: 0.5, Vulnerabilidade: 0.2 },
        sigma: 0.6
    },
    Confianca: {
        vector: { Valencia: 0.7, Energia: 0.75, Dominancia: 0.9, Melancolia: 0.1, Euforia: 0.6, Tensao: 0.3, ConexaoSocial: 0.4, Introspeccao: 0.2, Empoderamento: 0.95, Vulnerabilidade: 0.1 },
        sigma: 0.6
    },
    Energia: {
        vector: { Valencia: 0.5, Energia: 0.95, Dominancia: 0.7, Melancolia: 0.1, Euforia: 0.5, Tensao: 0.6, ConexaoSocial: 0.5, Introspeccao: 0.1, Empoderamento: 0.6, Vulnerabilidade: 0.1 },
        sigma: 0.6
    },
    Amor: {
        vector: { Valencia: 0.9, Energia: 0.3, Dominancia: 0.3, Melancolia: 0.2, Euforia: 0.4, Tensao: 0.1, ConexaoSocial: 0.95, Introspeccao: 0.4, Empoderamento: 0.4, Vulnerabilidade: 0.5 },
        sigma: 0.6
    },
    Paz: {
        vector: { Valencia: 0.8, Energia: 0.1, Dominancia: 0.2, Melancolia: 0.2, Euforia: 0.1, Tensao: 0.0, ConexaoSocial: 0.4, Introspeccao: 0.8, Empoderamento: 0.3, Vulnerabilidade: 0.4 },
        sigma: 0.6
    },
    Reflexao: {
        vector: { Valencia: 0.5, Energia: 0.2, Dominancia: 0.3, Melancolia: 0.4, Euforia: 0.1, Tensao: 0.2, ConexaoSocial: 0.3, Introspeccao: 0.95, Empoderamento: 0.4, Vulnerabilidade: 0.6 },
        sigma: 0.6
    },
    Tensao: {
        vector: { Valencia: 0.2, Energia: 0.8, Dominancia: 0.4, Melancolia: 0.4, Euforia: 0.1, Tensao: 0.95, ConexaoSocial: 0.1, Introspeccao: 0.5, Empoderamento: 0.2, Vulnerabilidade: 0.7 },
        sigma: 0.6
    },
    Revolta: {
        vector: { Valencia: 0.1, Energia: 0.95, Dominancia: 0.85, Melancolia: 0.2, Euforia: 0.1, Tensao: 0.8, ConexaoSocial: 0.1, Introspeccao: 0.2, Empoderamento: 0.7, Vulnerabilidade: 0.2 },
        sigma: 0.6
    },
    Frustracao: {
        vector: { Valencia: 0.2, Energia: 0.6, Dominancia: 0.3, Melancolia: 0.6, Euforia: 0.1, Tensao: 0.7, ConexaoSocial: 0.1, Introspeccao: 0.6, Empoderamento: 0.2, Vulnerabilidade: 0.6 },
        sigma: 0.6
    },
    Melancolia: {
        vector: { Valencia: 0.4, Energia: 0.2, Dominancia: 0.2, Melancolia: 0.85, Euforia: 0.1, Tensao: 0.3, ConexaoSocial: 0.4, Introspeccao: 0.8, Empoderamento: 0.2, Vulnerabilidade: 0.8 },
        sigma: 0.6
    },
    Tristeza: {
        vector: { Valencia: 0.1, Energia: 0.1, Dominancia: 0.1, Melancolia: 0.95, Euforia: 0.0, Tensao: 0.4, ConexaoSocial: 0.1, Introspeccao: 0.8, Empoderamento: 0.1, Vulnerabilidade: 0.95 },
        sigma: 0.6
    },
    Vazio: {
        vector: { Valencia: 0.2, Energia: 0.1, Dominancia: 0.1, Melancolia: 0.5, Euforia: 0.0, Tensao: 0.2, ConexaoSocial: 0.0, Introspeccao: 0.7, Empoderamento: 0.0, Vulnerabilidade: 0.6 },
        sigma: 0.6
    },
    Ambivalente: {
        vector: { Valencia: 0.5, Energia: 0.4, Dominancia: 0.4, Melancolia: 0.5, Euforia: 0.3, Tensao: 0.4, ConexaoSocial: 0.5, Introspeccao: 0.5, Empoderamento: 0.4, Vulnerabilidade: 0.5 },
        sigma: 0.45 // Mais estrito: só entra aqui se o vetor é muito central e sem picos
    },
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

    // Distância Euclidiana em N-Dimensões
    private euclideanDistanceND(vecA: EmotionalVector, vecB: EmotionalVector): number {
        let sumSquared = 0;
        for (const dim of EMOTIONAL_DIMENSIONS) {
            sumSquared += Math.pow(vecA[dim] - vecB[dim], 2);
        }
        return Math.sqrt(sumSquared);
    }

    // RBF kernel com distância Euclidiana (10D)
    private rbfSimilarity(distance: number, sigma: number): number {
        return Math.exp(-(distance * distance) / (2 * sigma * sigma));
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
    // -------------------------------------------------------------------------
    private polaridadeToMoodScore(polaridade: number): number {
        const k = 2.5;
        const raw = 1 / (1 + Math.exp(-k * polaridade));
        return 0.10 + raw * 0.80;
    }

    // -------------------------------------------------------------------------
    // Cálculo do eixo de ativação 2D (Apenas para visual UI/Geração prompt)
    // -------------------------------------------------------------------------
    calculateCoreAxes(vector: EmotionalVector): CoreAxes {
        const safeVector = this.sanitizeVector(vector);

        let rawPolaridade =
            Math.max(safeVector.Valencia, safeVector.Empoderamento * 0.8) * 0.50 +
            safeVector.Dominancia * 0.20 +
            safeVector.Empoderamento * 0.15 +
            safeVector.ConexaoSocial * 0.15 -
            safeVector.Melancolia * 0.20 -
            safeVector.Tensao * 0.15 -
            safeVector.Vulnerabilidade * 0.15;

        if (safeVector.Dominancia >= 0.7 && safeVector.Empoderamento >= 0.7) {
            rawPolaridade = Math.max(rawPolaridade, 0.65);
        }

        const polaridade = this.normalize(this.clamp(rawPolaridade));

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

    // -------------------------------------------------------------------------
    // NOVA CLASSIFICAÇÃO 10D
    // Compara o vetor com todos os perfis 10D e extrai a similaridade RBF.
    // -------------------------------------------------------------------------
    classifyEmotion(vector: EmotionalVector): EmotionClassification {
        const safeVector = this.sanitizeVector(vector);
        const coreAxes = this.calculateCoreAxes(safeVector);
        const { polaridade } = coreAxes;

        const entries = Object.entries(CLUSTER_PROFILES_10D);
        const affinities = entries.map(([label, profile]) => {
            const distance = this.euclideanDistanceND(safeVector, profile.vector);
            const affinity = this.rbfSimilarity(distance, profile.sigma);
            return { label, affinity };
        });

        const affinityValues = affinities.map(a => a.affinity);
        const probabilities = this.softmax(affinityValues);

        const emotionProbabilities = affinities
            .map((a, i) => ({ label: a.label, probability: probabilities[i] }))
            .sort((a, b) => b.probability - a.probability);

        const dominant = emotionProbabilities[0];
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
