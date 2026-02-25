import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Adicione sua API_KEY no .env
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    // Usaremos o gemini-1.5-flash por ser ultra rápido e barato
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: "application/json" } // Força o retorno em JSON
    });
  }

  async analyzeMusicMood(title: string, artist: string) {
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
}