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
  emotionalVector: EmotionalVector;
  tracks: {
    music: string;
    artist: string;
    emotionalVector: EmotionalVector;
    dominantSentiment: string,
  }[];
};


@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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
      // Estados Positivos Energéticos
      LaEmCima: (vector.Euforia + vector.Energia + vector.Valencia) / 3,
      NoFluxo: (vector.Empoderamento + vector.Energia + vector.Valencia) / 3,
      PartiuConquistar: (vector.Empoderamento + vector.Dominancia + vector.Energia) / 3,
      ModoChefe: (vector.Empoderamento + vector.Dominancia) / 2,

      // Estados Positivos Calmos
      GoodVibes: (vector.Valencia + vector.Introspeccao - vector.Tensao) / 2,
      GratidaoTotal: (vector.Valencia + vector.ConexaoSocial) / 2,
      CliminhaDeAmor: (vector.Euforia + vector.ConexaoSocial + vector.Valencia) / 3,
      FeNoFuturo: (vector.Valencia + vector.Empoderamento) / 2,

      // Estados Reflexivos
      SaudadeBoa: (vector.Melancolia + vector.Introspeccao) / 2,
      Pensativo: vector.Introspeccao,
      ViajandoNaMente: (vector.Introspeccao + vector.Valencia) / 2,

      // Estados Negativos Energéticos
      Pilhado: (vector.Tensao + vector.Energia) / 2,
      DeSacoCheio: (vector.Tensao + vector.Dominancia - vector.Valencia) / 2,
      Estourado: (vector.Tensao + vector.Dominancia + vector.Energia) / 3,

      // Estados Negativos Passivos
      Badzinho: (vector.Melancolia - vector.Energia) / 2,
      CoracaoAberto: vector.Vulnerabilidade,
      NaSua: (vector.Melancolia + vector.Introspeccao - vector.ConexaoSocial) / 3,
      SemGas: (vector.Melancolia - vector.Empoderamento) / 2
    };

    return Object.entries(clusters)
      .sort((a, b) => b[1] - a[1])[0][0];
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

      return {
        ...parsed,
        dominantSentiment,
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
        emotionalVector: fallbackVector,
        tracks: [],
      };
    }
  }
}