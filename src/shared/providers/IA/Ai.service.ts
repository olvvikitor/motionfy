import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Track } from '@prisma/client';

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

export type ResponseAi = {
  moodScore: number;
  dominantSentiment: string;
  emoticon: string;
  emotionalVector: EmotionalVector;
  tracks: {
    music: string;
    artist: string;
    emotionalVector: EmotionalVector;
    dominantSentiment: string,
  }[];
};

const SENTIMENT_CLUSTERS = {
  Euforico: ["Euforia", "Energia"],
  Confiante: ["Empoderamento", "Dominancia"],
  Melancolico: ["Melancolia"],
  Reflexivo: ["Introspeccao"],
  Ansioso: ["Tensao"],
  Neutro: []
} as const;

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          required: ["moodScore", "emotionalVector", "tracks"],
          properties: {
            moodScore: {
              type: SchemaType.NUMBER,
            },
            emotionalVector: {
              type: SchemaType.OBJECT,
              required: [...EMOTIONAL_DIMENSIONS],
              properties: Object.fromEntries(
                EMOTIONAL_DIMENSIONS.map((dimension) => [
                  dimension,
                  { type: SchemaType.NUMBER },
                ])
              ),
            },
            tracks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                required: ["music", "artist", "emotionalVector"],
                properties: {
                  music: { type: SchemaType.STRING },
                  artist: { type: SchemaType.STRING },
                  emotionalVector: {
                    type: SchemaType.OBJECT,
                    required: [...EMOTIONAL_DIMENSIONS],
                    properties: Object.fromEntries(
                      EMOTIONAL_DIMENSIONS.map((dimension) => [
                        dimension,
                        { type: SchemaType.NUMBER },
                      ])
                    ),
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private calculateDominantSentiment(vector: EmotionalVector): string {
    const clusters = {
      Euforico: (vector.Euforia + vector.Energia) / 2,
      Confiante: (vector.Empoderamento + vector.Dominancia) / 2,
      Melancolico: vector.Melancolia,
      Reflexivo: vector.Introspeccao,
      Ansioso: vector.Tensao
    };

    let dominant = "Neutro";
    let highestScore = 0.45; // baseline mínimo

    for (const [sentiment, score] of Object.entries(clusters)) {
      if (score > highestScore) {
        highestScore = score;
        dominant = sentiment;
      }
    }

    return dominant;
  }

  private mapSentimentToEmoji(sentiment: string): string {
    const map: Record<string, string> = {
      Euforico: "😄",
      Melancolico: "😔",
      Confiante: "💪",
      Reflexivo: "🤔",
      Ansioso: "😰",
      Neutro: "😐",
    };

    return map[sentiment] ?? "😐";
  }

  async analyzeMusicMoodByHistoryToday(musics: Track[]): Promise<ResponseAi> {
    const musicasLimpas = musics.map((musica) => ({
      title: musica.title,
      artist: musica.artist,
    }));

    const prompt = `
        Você é um especialista em análise emocional de músicas.

        Analise todas as músicas abaixo e gere um vetor emocional universal para cada uma:

        ${JSON.stringify(musicasLimpas, null, 2)}

        Para cada dimensão emocional abaixo, atribua um valor entre 0.0 e 1.0:

        ${EMOTIONAL_DIMENSIONS.join("\n")}

        ⚠️ Gere obrigatoriamente um objeto para cada música no campo "tracks".
        ⚠️ O campo "tracks" deve conter exatamente ${musicasLimpas.length} itens.
        ⚠️ Responda APENAS com JSON válido.
        `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      const parsed = JSON.parse(response) as ResponseAi;

      const tracksWithSentiment = parsed.tracks.map((track) => {
        const dominantSentiment = this.calculateDominantSentiment(
          track.emotionalVector
        );
        return {
          ...track,
          dominantSentiment,
        };
      });


      const dominantSentiment = this.calculateDominantSentiment(parsed.emotionalVector);
      const emoticon = this.mapSentimentToEmoji(dominantSentiment);

      return {
        ...parsed,
        dominantSentiment,
        emoticon,
        tracks: tracksWithSentiment
      };
    } catch (error) {
      console.log("Erro ao chamar o Gemini:", error);

      const fallbackVector = Object.fromEntries(
        EMOTIONAL_DIMENSIONS.map((d) => [d, 0.5])
      ) as EmotionalVector;

      return {
        moodScore: 0.5,
        dominantSentiment: "Neutro",
        emoticon: "😐",
        emotionalVector: fallbackVector,
        tracks: [],
      };
    }
  }
}