import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Track } from '@prisma/client';


export type ResponseAi = {
  moodScore: number,
  sentiment: string,
  emoticon:string
  emotions: string[]
}

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Adicione sua API_KEY no .env
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    // Usaremos o gemini-1.5-flash por ser ultra rápido e barato
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: "application/json" } // Força o retorno em JSON
    });
  }

  async analyzeMusicMoodMusic(title: string, artist: string) {
    const prompt = `
        Analise profundamente a música ${title} dos artistas ${artist}.

        Considere obrigatoriamente:

        1. A letra: temas centrais, mensagens implícitas, subjetividade, conflitos internos, críticas sociais e simbologia.
        2. O ritmo e instrumental: intensidade, cadência, atmosfera sonora, escolhas de produção.
        3. O contexto histórico e cultural do hip-hop/rap brasileiro.
        4. O momento atual da carreira do artista BK e o que ele representa hoje na cena musical brasileira.
        5. A data atual e como a música dialoga com o cenário social contemporâneo.

        Com base nessa análise completa, avalie o impacto emocional predominante da faixa.

        Retorne exclusivamente um JSON válido, sem explicações, sem texto adicional, sem comentários.

        Formato obrigatório:

        {
          "moodScore": número decimal entre 0.0 e 1.0 (onde 0.0 é extremamente negativo/pesado e 1.0 é extremamente positivo/eufórico),
          "sentiment": "uma única palavra em Português-BR representando o sentimento predominante",
          "emotions": ["exatamente 3 emoções distintas em Português-BR"]
        }

        Regras:
        - Não inclua nenhum texto fora do JSON.
        - Não use quebras de padrão.
        - Não inclua explicações.
        - As emoções devem ser palavras únicas.
        - O JSON deve ser estritamente válido.
            `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      return JSON.parse(response);
    } catch (error) {
      console.log("Erro ao chamar o Gemini:", error);
      // Retorno de fallback caso a IA falhe ou não conheça a música
      return { moodScore: 0.5, sentiment: 'Neutro', emotions: ['neutro'] };
    }
  }

  async analyzeMusicMoodByHistoryToday(musics: Track[]):Promise<ResponseAi> {
    const musicasLimpas = musics.map((musica) => {
      return { title: musica.title, artist: musica.artist }
    })
    const prompt = `
        Você é um especialista em análise emocional de músicas
        Analise profundamente as seguintes músicas:
        ${JSON.stringify(musicasLimpas)}

        A análise deve considerar obrigatoriamente:

        - Letra: temas centrais, conflitos internos, críticas sociais, subjetividade e simbologias.
        - Ritmo e instrumental: intensidade, atmosfera, energia, escolhas de produção.
        - Contexto cultural do rap brasileiro.
        - O momento atual da carreira de BK na cena musical.
        - O cenário social contemporâneo no Brasil.

        Com base na análise integrada de TODOS esses fatores, determine o impacto emocional predominante.

        ⚠️ Responda APENAS com um JSON válido.
        ⚠️ Não inclua explicações.
        ⚠️ Não inclua comentários.
        ⚠️ Não inclua texto antes ou depois do JSON.
        ⚠️ Não utilize markdown.
        ⚠️ O JSON deve ser estritamente válido.

        Formato obrigatório:

        {
          "moodScore": número decimal entre 0.0 e 1.0 com no máximo 2 casas decimais,
          "sentiment": "uma única palavra ex:(Motivado, Focado, Ansioso) em Português-BR",
          "emoticon": "um emote que represente o sentimento, no design do iphone"
          "emotions": ["exatamente 3 palavras únicas em Português-BR"]
        }

        Regras obrigatórias:

        - moodScore deve refletir a intensidade emocional geral.
        - 0.0 = extremamente negativo/pesado
        - 0.5 = emocionalmente neutro/ambivalente
        - 1.0 = extremamente positivo/eufórico
        - As emoções não podem se repetir.
        - As emoções devem ser palavras únicas (sem frases).
        - Não use acentos inconsistentes.
        - O JSON deve ser válido para JSON.parse().
        `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      return JSON.parse(response) as ResponseAi;
    } catch (error) {
      console.log("Erro ao chamar o Gemini:", error);
      // Retorno de fallback caso a IA falhe ou não conheça a música
      return { moodScore: 0.5, sentiment: 'Neutro', emotions: ['neutro'], emoticon:"😐"};
    }
  }
}