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
      Analise a música "${title}" do artista "${artist}". 
      Considere a letra, o ritmo e a sonoridade histórica desta faixa.
      Retorne um objeto JSON estrito com:
      {
        "moodScore": número de 0.0 a 1.0,
        "sentiment": "uma palavra em inglês (ex: Sad, Happy, Calm, Dark)",
        "emotions": ["array", "com", "3", "emoções", "em", "inglês"]
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      return JSON.parse(response);
    } catch (error) {
      console.log("Erro ao chamar o Gemini:", error);
      // Retorno de fallback caso a IA falhe ou não conheça a música
      return { moodScore: 0.5, sentiment: 'Neutral', emotions: ['neutral'] };
    }
  }
}