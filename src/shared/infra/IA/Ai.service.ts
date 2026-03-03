import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Track } from '@prisma/client';
import { CoreAxes, EMOTIONAL_DIMENSIONS, EmotionalVector, EmotionAnalysisService } from './emotion-analysis.service';


export type ResponseAi = {
  moodScore: number;
  dominantSentiment: string;
  emotionalVector: EmotionalVector;
  coreAxes: CoreAxes;
  tracks: {
    id: string;
    music: string;
    artist: string;
    img_url: string;
    emotionalVector: EmotionalVector;
    dominantSentiment: string;
    moodScore: number;
    coreAxes:CoreAxes;
  }[];
};

type GeminiResponse = {
  moodScore: number;
  emotionalVector: EmotionalVector;
  tracks: {
    id: string;
    music: string;
    artist: string;
    emotionalVector: EmotionalVector;
  }[];
};

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private readonly emotionAnalysis: EmotionAnalysisService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          required: ["moodScore", "emotionalVector", "tracks"],
          properties: {
            moodScore: { type: SchemaType.NUMBER },
            emotionalVector: {
              type: SchemaType.OBJECT,
              required: [...EMOTIONAL_DIMENSIONS],
              properties: Object.fromEntries(
                EMOTIONAL_DIMENSIONS.map(d => [d, { type: SchemaType.NUMBER }])
              ),
            },
            tracks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                required: ["id", "music", "artist", "emotionalVector"],
                properties: {
                  id:     { type: SchemaType.STRING },
                  music:  { type: SchemaType.STRING },
                  artist: { type: SchemaType.STRING },
                  emotionalVector: {
                    type: SchemaType.OBJECT,
                    required: [...EMOTIONAL_DIMENSIONS],
                    properties: Object.fromEntries(
                      EMOTIONAL_DIMENSIONS.map(d => [d, { type: SchemaType.NUMBER }])
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

  private buildPrompt(musics: { id: string; title: string; artist: string }[]): string {
    return `
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
⚠️ O campo "tracks" deve conter exatamente ${musics.length} itens.  
⚠️ Gere obrigatoriamente um objeto para cada música fornecida.

### MÚSICAS PARA ANÁLISE

${JSON.stringify(musics, null, 2)}
`;
  }

  async analyzeMusicMoodByHistoryToday(musics: Track[]): Promise<ResponseAi> {
    // Preserva imagens sem enviá-las à IA
    const imageMap = new Map<string, string>(
      musics.map(m => [m.id, m.img_url!])
    );

    const musicasLimpas = musics.map(({ id, title, artist }) => ({ id, title, artist }));

    try {
      const result = await this.model.generateContent(this.buildPrompt(musicasLimpas));
      const parsed = JSON.parse(result.response.text()) as GeminiResponse;

      const tracksWithSentiment = parsed.tracks.map((track) => {
        const { coreAxes, dominantSentiment, moodScore } =
          this.emotionAnalysis.classifyEmotion(track.emotionalVector);

        return {
          ...track,
          img_url: imageMap.get(track.id) ?? '',
          dominantSentiment,
          moodScore,
          coreAxes,
        };
      });

      const overallEmotion = this.emotionAnalysis.classifyEmotion(parsed.emotionalVector);

      return {
        ...parsed,
        dominantSentiment: overallEmotion.dominantSentiment,
        moodScore: overallEmotion.moodScore,
        coreAxes: overallEmotion.coreAxes,
        tracks: tracksWithSentiment,
      };

    } catch (error) {
      console.error("Erro ao chamar o Gemini:", error);

      const fallbackVector = this.emotionAnalysis.buildFallbackVector();
      const fallbackEmotion = this.emotionAnalysis.classifyEmotion(fallbackVector);

      return {
        moodScore: fallbackEmotion.moodScore,
        dominantSentiment: fallbackEmotion.dominantSentiment,
        emotionalVector: fallbackVector,
        coreAxes: fallbackEmotion.coreAxes,
        tracks: [],
      };
    }
  }
}