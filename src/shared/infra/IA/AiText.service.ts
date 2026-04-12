import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Track } from '@prisma/client';
import { CoreAxes, EMOTIONAL_DIMENSIONS, EmotionalVector, EmotionAnalysisService } from './emotion-analysis.service';

export type ResponseAi = {
  moodScore: number;
  dominantSentiment: string;
  emotionalVector: EmotionalVector;
  reasoning: string;

  coreAxes: CoreAxes;
  image_mood: string
  mostListenedGenre?: string;
  mostListenedSong?: {
    name: string;
    artist: string;
    img_url: string;
  };
  tracks: {
    id: string;
    music: string;
    artist: string;
    img_url: string;
    emotionalVector: EmotionalVector;
    dominantSentiment: string;
    reasoning: string;
    moodScore: number;
    genre: string;
    subgenre: string;
    coreAxes: CoreAxes;
  }[];
};

type GeminiResponse = {
  moodScore: number;
  emotionalVector: EmotionalVector;
  reasoning: string;
  tracks: {
    id: string;
    music: string;
    reasoning: string;
    genre: string;
    subgenre: string;
    artist: string;
    emotionalVector: EmotionalVector;
  }[];
};

@Injectable()
export class AiTextService {
  private genAI: GoogleGenerativeAI;
  private music_model: any;

  constructor(private readonly emotionAnalysis: EmotionAnalysisService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    this.music_model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        // FIX: temperature mais alta reduz regressão à média quando o schema JSON
        // já garante que o music_modelo não vai "delirar" fora do formato esperado.
        temperature: 0.7,
        topP: 0.9,
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
            reasoning: { type: SchemaType.STRING },
            tracks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                required: ["id", "music", "artist", "emotionalVector", "genre", "subgenre"],
                properties: {
                  id: { type: SchemaType.STRING },
                  music: { type: SchemaType.STRING },
                  artist: { type: SchemaType.STRING },
                  reasoning: { type: SchemaType.STRING },
                  genre: { type: SchemaType.STRING },
                  subgenre: { type: SchemaType.STRING },
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
Você é um sistema de análise psicométrica de música. Sua única tarefa é extrair vetores emocionais precisos e polarizados.

## REGRA FUNDAMENTAL: EVITE O CENTRO

Valores entre 0.35 e 0.65 são PROIBIDOS salvo casos de genuína neutralidade.
Toda música tem uma identidade emocional forte. Encontre-a e pontue nos extremos.

## ESCALA DE REFERÊNCIA (músicas âncora)

Use estas âncoras para calibrar sua escala interna antes de analisar:

| Música                              | Val | Ene | Dom | Mel | Euf | Ten | Soc | Int | Emp | Vul |
|-------------------------------------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| "Happy" – Pharrell Williams         |0.95 |0.85 |0.60 |0.05 |0.90 |0.05 |0.80 |0.10 |0.70 |0.05 |
| "Smells Like Teen Spirit" - Nirvana |0.25 |0.92 |0.80 |0.45 |0.30 |0.80 |0.85 |0.20 |0.60 |0.40 |
| "The Sound of Silence" – S&G        |0.20 |0.15 |0.10 |0.90 |0.05 |0.40 |0.05 |0.95 |0.10 |0.85 |
| "Eye of the Tiger" – Survivor       |0.75 |0.95 |0.95 |0.05 |0.70 |0.55 |0.60 |0.10 |0.95 |0.05 |
| "Mad World" – Gary Jules            |0.10 |0.10 |0.05 |0.95 |0.02 |0.35 |0.05 |0.90 |0.05 |0.95 |
| "Redemption Song" – Bob Marley      |0.70 |0.20 |0.50 |0.30 |0.15 |0.20 |0.70 |0.80 |0.90 |0.35 |
| "Perfect" – Ed Sheeran              |0.85 |0.35 |0.30 |0.10 |0.40 |0.05 |0.90 |0.40 |0.40 |0.70 |
| "Creep" – Radiohead                 |0.15 |0.60 |0.20 |0.80 |0.10 |0.85 |0.05 |0.95 |0.05 |0.95 |
| "Titanium" – David Guetta & Sia     |0.80 |0.98 |0.90 |0.10 |0.85 |0.40 |0.75 |0.15 |0.95 |0.15 |
| "Yellow" – Coldplay                 |0.75 |0.55 |0.40 |0.25 |0.30 |0.15 |0.85 |0.60 |0.50 |0.80 |
| "Holocene" – Bon Iver               |0.60 |0.15 |0.10 |0.20 |0.05 |0.05 |0.30 |0.95 |0.30 |0.85 |
| "Jesus Chorou" – Racionais MC's     |0.20 |0.50 |0.60 |0.80 |0.10 |0.70 |0.80 |0.90 |0.40 |0.85 |
| "Conexões de Máfia" – Matuê         |0.50 |0.85 |0.90 |0.10 |0.60 |0.65 |0.60 |0.20 |0.85 |0.20 |
| "SICKO MODE" – Travis Scott         |0.40 |0.95 |0.95 |0.10 |0.80 |0.75 |0.60 |0.10 |0.90 |0.10 |
| "País Tropical" – Jorge Ben Jor     |0.95 |0.85 |0.60 |0.05 |0.85 |0.10 |0.90 |0.10 |0.70 |0.05 |
| "Águas de Março" – Elis Regina      |0.70 |0.30 |0.20 |0.25 |0.20 |0.05 |0.40 |0.70 |0.40 |0.50 |

## DEFINIÇÕES COM ÂNCORAS VERBAIS

1. **Valencia** [0.0–1.0]
   - 0.0 = desespero existencial / ódio ("Mad World")
   - 0.5 = ambiguidade real ("Mr. Brightside")
   - 0.7 = paz, esperança reflexiva ("Redemption Song")
   - 1.0 = alegria pura e inabalável ("Happy")

2. **Energia** [0.0–1.0]
   - 0.0 = minimalismo quase silencioso, BPM < 60
   - 0.5 = pop médio, balada de rock
   - 1.0 = metal, EDM, punk. BPM > 160, intensidade sonora máxima

3. **Dominancia** [0.0–1.0]
   - 0.0 = súplica, fragilidade, submissão
   - 1.0 = agressividade, autoridade, comando ("Eye of the Tiger")

4. **Melancolia** [0.0–1.0]
   - 0.0 = sem traço de tristeza ou saudade ("Happy")
   - 0.5 = nostalgia suave, reflexão sobre o passado ("Redemption Song")
   - 1.0 = luto, perda irreparável, saudade consumidora ("The Sound of Silence")

5. **Euforia** [0.0–1.0]
   - 0.0 = apatia, indiferença, introspecção profunda
   - 1.0 = êxtase, celebração maníaca, peak emocional ("Happy")

6. **Tensao** [0.0–1.0]
   - 0.0 = relaxamento total, harmonia resolvida ("Redemption Song")
   - 1.0 = ansiedade, dissonância irresolvida, conflito ("Smells Like Teen Spirit")

7. **ConexaoSocial** [0.0–1.0]
   - 0.0 = isolamento absoluto, monólogo interior
   - 1.0 = hinos coletivos, "nós", pertencimento ("Redemption Song", "Happy")

8. **Introspeccao** [0.0–1.0]
   - 0.0 = letra de festa, superficial, sem reflexão
   - 1.0 = filosofia existencial, segredos íntimos, diário ("The Sound of Silence", "Redemption Song")

9. **Empoderamento** [0.0–1.0]
   - 0.0 = derrota, vitimização
   - 1.0 = superação, libertação mental, autoconfiança inabalável ("Eye of the Tiger", "Redemption Song")

10. **Vulnerabilidade** [0.0–1.0]
    - 0.0 = armadura emocional, frieza, distância
    - 1.0 = exposição de feridas, intimidade crua, choro ("Mad World")

## PROCESSO DE ANÁLISE (siga esta ordem)

Para cada música:
1. Identifique o gênero e contexto histórico
2. Liste as 3 dimensões mais salientes (aquelas > 0.7 ou < 0.3)
3. Escreva o reasoning (máx. 12 palavras, foco em letra + instrumentação)
4. Preencha TODAS as 10 dimensões com valores polarizados

## MÚSICAS PARA ANÁLISE

${JSON.stringify(musics, null, 2)}

⚠️ O campo "tracks" deve conter exatamente ${musics.length} itens, um para cada música.
⚠️ Responda APENAS com JSON válido. Sem comentários, sem explicações fora do JSON.
`;
  }

  async analyzeMusicMoodByHistoryToday(musics: Track[]): Promise<ResponseAi> {
    const imageMap = new Map<string, string>(
      musics.map(m => [m.id, m.img_url!])
    );

    const musicasLimpas = musics.map(({ id, title, artist }) => ({ id, title, artist }));

    try {
      const result = await this.music_model.generateContent(this.buildPrompt(musicasLimpas));
      const parsed = JSON.parse(result.response.text()) as GeminiResponse;

      const tracksWithSentiment = parsed.tracks.map((track) => {
        const { coreAxes, dominantSentiment, moodScore } =
          this.emotionAnalysis.classifyEmotion(track.emotionalVector);

        return {
          ...track,
          img_url: imageMap.get(track.id) ?? '',
          dominantSentiment,
          genre: track.genre,
          subgenre: track.subgenre,
          moodScore,
          coreAxes,
        };
      });

      const overallEmotion = this.emotionAnalysis.classifyEmotion(parsed.emotionalVector);

      return {
        ...parsed,
        dominantSentiment: overallEmotion.dominantSentiment,
        moodScore: overallEmotion.moodScore,
        image_mood: '',
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
        reasoning: '',
        image_mood: '',
        tracks: [],
      };
    }
  }
}
