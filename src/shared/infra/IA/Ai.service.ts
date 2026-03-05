import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Track } from '@prisma/client';
import { CoreAxes, EMOTIONAL_DIMENSIONS, EmotionalVector, EmotionAnalysisService } from './emotion-analysis.service';


export type ResponseAi = {
  moodScore: number;
  dominantSentiment: string;
  emotionalVector: EmotionalVector;
  reasoning: string; // <--- Adicione aqui
  coreAxes: CoreAxes;
  tracks: {
    id: string;
    music: string;
    artist: string;
    img_url: string;
    emotionalVector: EmotionalVector;
    dominantSentiment: string;
    reasoning: string;
    moodScore: number;
    coreAxes: CoreAxes;
  }[];
};

type GeminiResponse = {
  moodScore: number;
  emotionalVector: EmotionalVector;
  reasoning: string; // <--- Adicione aqui
  tracks: {
    id: string;
    music: string;
    reasoning: string; // <--- Adicione aqui
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
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.2,
        topP: 0.6,
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
                required: ["id", "music", "artist", "emotionalVector"],
                properties: {
                  id: { type: SchemaType.STRING },
                  music: { type: SchemaType.STRING },
                  artist: { type: SchemaType.STRING },
                  reasoning: { type: SchemaType.STRING },// <--- Adicione aqui
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
Você é um especialista em psicologia da música e análise psicométrica. Sua tarefa é realizar uma extração técnica de vetores emocionais.

### DIRETRIZES DE PONTUAÇÃO (POLARIZAÇÃO OBRIGATÓRIA)

Para evitar o viés da média (valores próximos a 0.5), aplique as seguintes regras:
- SEJA DECISIVO: Se uma música é claramente energética, a pontuação deve ser > 0.8. Se não é, deve ser < 0.3. Evite 0.5 a menos que a música seja genuinamente neutra.
- VALÊNCIA vs ENERGIA: Diferencie claramente "Tristeza Ativa" (Raiva/Frustração) de "Tristeza Passiva" (Melancolia).
- CONTEXTO HISTÓRICO: Considere que o Rock Grunge (90s) tem uma 'Melancolia' agressiva (alta tensão), enquanto o Folk tem uma 'Melancolia' suave (baixa tensão).
- REASONING: Para cada música, escreva uma frase curta (máx. 15 palavras) justificando o vetor baseado na letra e instrumentação.
### DEFINIÇÕES DAS DIMENSÕES (ANCORAGEM)

1. Valencia: 1.0 = Extrema alegria/esperança; 0.0 = Desespero/Ódio profundo.
2. Energia: 1.0 = Ritmo frenético, alta pressão sonora; 0.0 = Silencioso, minimalista.
3. Dominancia: 1.0 = Empoderamento, agressividade, controle; 0.0 = Submissão, fragilidade.
4. Melancolia: 1.0 = Luto, perda profunda, saudade; 0.0 = Euforia total.
5. Euforia: 1.0 = Êxtase, celebração maníaca; 0.0 = Apatia.
6. Tensao: 1.0 = Ansiedade, dissonância, conflito; 0.0 = Relaxamento muscular total.
7. ConexaoSocial: 1.0 = Hinos de união, letras sobre "nós"; 0.0 = Solidão absoluta, isolamento.
8. Introspeccao: 1.0 = Filosofia existencialista, segredos íntimos; 0.0 = Letra de festa, comercial.
9. Empoderamento: 1.0 = Superação de desafios, autoconfiança; 0.0 = Derrota, baixa autoestima.
10. Vulnerabilidade: 1.0 = Exposição de feridas emocionais, choro; 0.0 = Armadura emocional, frieza.

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
        reasoning: '',
        tracks: [],
      };
    }
  }
}