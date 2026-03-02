import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Track } from '@prisma/client';


// No topo do seu service ou em um arquivo de tipos
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

export type ResponseAi = {
  moodScore: number;
  dominantSentiment: string;
  emotionalVector: EmotionalVector;
  tracks: {
    music: string;
    artist: string;
    img_url: string,
    id: string,
    emotionalVector: EmotionalVector;
    dominantSentiment: string,
    moodScore: number
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
                required: ["id", "music", "artist", "emotionalVector"],
                properties: {
                  id: { type: SchemaType.STRING },
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

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private calculateDominantSentiment(vector: EmotionalVector): SentimentResult {
    const clusters = {
      EuforiaAtiva: this.clamp(vector.Valencia * 0.4 + vector.Energia * 0.3 + vector.Euforia * 0.3),
      ConfiancaDominante: this.clamp(vector.Empoderamento * 0.4 + vector.Dominancia * 0.3 + vector.Energia * 0.3),
      Serenidade: this.clamp(vector.Valencia * 0.4 + vector.Introspeccao * 0.3 - vector.Tensao * 0.3),
      ConexaoAfetiva: this.clamp(vector.Valencia * 0.4 + vector.ConexaoSocial * 0.4 + vector.Vulnerabilidade * 0.2),
      NostalgiaProfunda: this.clamp(vector.Melancolia * 0.4 + vector.Introspeccao * 0.4 + vector.Valencia * 0.2),
      Contemplacao: this.clamp(vector.Introspeccao * 0.6 + vector.Valencia * 0.2 + vector.Energia * 0.2),
      IrritacaoAtiva: this.clamp(vector.Tensao * 0.4 + vector.Energia * 0.3 + vector.Dominancia * 0.3),
      RaivaExplosiva: this.clamp(vector.Tensao * 0.4 + vector.Dominancia * 0.4 + vector.Energia * 0.2),
      Desanimo: this.clamp(vector.Melancolia * 0.5 + vector.Energia * -0.3 + vector.Empoderamento * -0.2),
      VulnerabilidadeEmocional: this.clamp(vector.Vulnerabilidade * 0.6 + vector.Introspeccao * 0.4)
    };

    // Ordena para pegar o maior valor
    const [label, score] = Object.entries(clusters)
      .sort((a, b) => b[1] - a[1])[0];

    return { label, score };
  }
  async analyzeMusicMoodByHistoryToday(musics: Track[]): Promise<ResponseAi> {
    // 🔒 Criamos um mapa para guardar a imagem sem enviar para IA
    const imageMap = new Map<string, string>();

    const musicasLimpas = musics.map((musica) => {
      imageMap.set(musica.id, musica.img_url!);

      return {
        id: musica.id,
        title: musica.title,
        artist: musica.artist,
        // ❌ NÃO enviamos img_url para análise
      };
    });

    const prompt = `
Você é um especialista em psicologia da música, análise semântica e teoria emocional.

Sua tarefa é gerar um vetor emocional universal para cada música fornecida.

### CONTEXTO DE ANÁLISE

Para cada música, leve em consideração obrigatoriamente:

1. A LETRA (tema, narrativa, intensidade emocional, vocabulário)
2. O GÊNERO MUSICAL (impacto cultural e padrão emocional típico do gênero)
3. O ANO DE LANÇAMENTO (contexto histórico, tendência emocional da época)
4. A ENERGIA típica associada ao estilo musical
5. O clima emocional predominante (valência positiva/negativa)
6. A profundidade lírica (superficial vs introspectiva)

### REGRAS IMPORTANTES

- Não ignore o gênero musical.
- Não ignore o ano.
- Ajuste o vetor emocional considerando o contexto histórico da época.
- Rock dos anos 90 ≠ Pop dos anos 2010 (considere diferenças culturais).
- Trap moderno tende a ter energia alta e valência ambígua.
- Música religiosa tende a alta transcendência e esperança.
- Música romântica pode ter alta intensidade emocional, mesmo com baixa energia.

### DIMENSÕES EMOCIONAIS

Para cada dimensão abaixo, gere um valor entre 0.0 e 1.0:

${EMOTIONAL_DIMENSIONS.join("\n")}

### ESCALA

0.0 → ausência total da emoção  
0.5 → presença moderada  
1.0 → emoção dominante e intensa  

Use valores decimais com no máximo 2 casas.

### ESTRUTURA DE RESPOSTA

⚠️ Responda APENAS com JSON válido.  
⚠️ Não inclua explicações.  
⚠️ Não inclua comentários.  
⚠️ O campo "tracks" deve conter exatamente ${musicasLimpas.length} itens.  
⚠️ Gere obrigatoriamente um objeto para cada música fornecida.

### MÚSICAS PARA ANÁLISE

${JSON.stringify(musicasLimpas, null, 2)}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      const parsed = JSON.parse(response) as ResponseAi;

      const tracksWithSentiment = parsed.tracks.map((track) => {
        // Cálculo matemático real baseado no vetor que o Gemini gerou
        const { label, score } = this.calculateDominantSentiment(track.emotionalVector);

        return {
          ...track,
          img_url: imageMap.get(track.id) ?? '',
          dominantSentiment: label,
          moodScore: score, // Agora o score é fiel ao vetor!
        };
      });

      // Sentimento dominante do dia (geral)
      const overallSentiment = this.calculateDominantSentiment(parsed.emotionalVector);

      return {
        ...parsed,
        dominantSentiment: overallSentiment.label,
        moodScore: overallSentiment.score,
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