import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Track } from '@prisma/client';
import { CoreAxes, EMOTIONAL_DIMENSIONS, EmotionalVector, EmotionAnalysisService } from './emotion-analysis.service';
import { CreativePromptBlocks, HybridPromptInput, ImagePromptService } from './ImagePrompt.service';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import * as https from 'https';
import * as http from 'http';



export type ResponseAi = {
  moodScore: number;
  dominantSentiment: string;
  emotionalVector: EmotionalVector;
  reasoning: string;
  coreAxes: CoreAxes;
  image_mood: string
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
  reasoning: string;
  tracks: {
    id: string;
    music: string;
    reasoning: string;
    artist: string;
    emotionalVector: EmotionalVector;
  }[];
};

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private music_model: any;
  private image_model: any;
  private creative_blocks_model: any;

  constructor(private readonly emotionAnalysis: EmotionAnalysisService, private image_promprService: ImagePromptService) {
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
                required: ["id", "music", "artist", "emotionalVector"],
                properties: {
                  id: { type: SchemaType.STRING },
                  music: { type: SchemaType.STRING },
                  artist: { type: SchemaType.STRING },
                  reasoning: { type: SchemaType.STRING },
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

    this.image_model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        temperature: 0.9,
        topP: 0.8,
        topK: 55
      }
    });

    this.creative_blocks_model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          required: [
            "shotComposition",
            "cameraLanguage",
            "gazeBehavior",
            "pose",
            "action",
            "worldFlavor",
            "environment",
          ],
          properties: {
            shotComposition: { type: SchemaType.STRING },
            cameraLanguage: { type: SchemaType.STRING },
            gazeBehavior: { type: SchemaType.STRING },
            pose: { type: SchemaType.STRING },
            action: { type: SchemaType.STRING },
            worldFlavor: { type: SchemaType.STRING },
            environment: { type: SchemaType.STRING },
          },
        },
      },
    });
  }

  private sanitizeCreativeValue(value: unknown, fallback: string): string {
    if (typeof value !== "string") return fallback;

    const cleaned = value
      .replace(/\s+/g, " ")
      .replace(/[\r\n\t]+/g, " ")
      .trim();

    return cleaned || fallback;
  }

  private async generateCreativePromptBlocks(input: HybridPromptInput): Promise<Partial<CreativePromptBlocks>> {
    const seed = this.image_promprService.getCreativeSeed(input);

    const instruction = `
Generate cinematic creative blocks for an anime image prompt.
Keep each field as one concise line (6-18 words), candid and non-editorial.
Do not mention photorealism, cameras brands, or markdown.
Respect studio-first style and avoid conflicting with anime style.

Input context:
- sentiment: ${input.sentiment}
- quadrant: ${input.coreAxes.quadrante}
- activation: ${input.coreAxes.ativacao}
- moodScore: ${input.moodScore}
- studioId: ${input.studioId ?? "random"}

Seed values (improve, don't copy literally):
${JSON.stringify(seed, null, 2)}
`;

    const result = await this.creative_blocks_model.generateContent(instruction);
    const parsed = JSON.parse(result.response.text()) as Partial<CreativePromptBlocks>;

    return {
      shotComposition: this.sanitizeCreativeValue(parsed.shotComposition, seed.shotComposition),
      cameraLanguage: this.sanitizeCreativeValue(parsed.cameraLanguage, seed.cameraLanguage),
      gazeBehavior: this.sanitizeCreativeValue(parsed.gazeBehavior, seed.gazeBehavior),
      pose: this.sanitizeCreativeValue(parsed.pose, seed.pose),
      action: this.sanitizeCreativeValue(parsed.action, seed.action),
      worldFlavor: this.sanitizeCreativeValue(parsed.worldFlavor, seed.worldFlavor),
      environment: this.sanitizeCreativeValue(parsed.environment, seed.environment),
    };
  }

  async buildHybridImagePrompt(input: HybridPromptInput): Promise<string> {
    try {
      const creativeBlocks = await this.generateCreativePromptBlocks(input);
      return this.image_promprService.build(input, creativeBlocks);
    } catch (error) {
      console.warn("Falha ao gerar blocos criativos por IA, usando fallback local:", error);
      return this.image_promprService.build(input);
    }
  }

  private buildPrompt(musics: { id: string; title: string; artist: string }[]): string {
    return `
Você é um sistema de análise psicométrica de música. Sua única tarefa é extrair vetores emocionais precisos e polarizados.

## REGRA FUNDAMENTAL: EVITE O CENTRO

Valores entre 0.35 e 0.65 são PROIBIDOS salvo casos de genuína neutralidade.
Toda música tem uma identidade emocional forte. Encontre-a e pontue nos extremos.

## ESCALA DE REFERÊNCIA (músicas âncora)

Use estas âncoras para calibrar sua escala interna antes de analisar:

| Música                              | Valencia | Energia | Melancolia | Euforia | Tensao |
|-------------------------------------|----------|---------|------------|---------|--------|
| "Happy" – Pharrell Williams         | 0.95     | 0.85    | 0.05       | 0.90    | 0.05   |
| "Smells Like Teen Spirit" – Nirvana | 0.25     | 0.92    | 0.45       | 0.30    | 0.80   |
| "The Sound of Silence" – S&G        | 0.20     | 0.15    | 0.90       | 0.05    | 0.40   |
| "Eye of the Tiger" – Survivor       | 0.75     | 0.95    | 0.05       | 0.70    | 0.55   |
| "Mad World" – Gary Jules            | 0.10     | 0.10    | 0.95       | 0.02    | 0.35   |
| "Mr. Brightside" – The Killers      | 0.40     | 0.88    | 0.55       | 0.45    | 0.85   |

## DEFINIÇÕES COM ÂNCORAS VERBAIS

1. **Valencia** [0.0–1.0]
   - 0.0 = desespero existencial / ódio ("Mad World")
   - 0.5 = ambiguidade real ("Mr. Brightside")
   - 1.0 = alegria pura e inabalável ("Happy")

2. **Energia** [0.0–1.0]
   - 0.0 = minimalismo quase silencioso, BPM < 60
   - 0.5 = pop médio, balada de rock
   - 1.0 = metal, EDM, punk. BPM > 160, intensidade sonora máxima

3. **Dominancia** [0.0–1.0]
   - 0.0 = súplica, fragilidade, submissão
   - 1.0 = agressividade, autoridade, comando ("Eye of the Tiger")

4. **Melancolia** [0.0–1.0]
   - 0.0 = sem traço de tristeza ou saudade
   - 1.0 = luto, perda irreparável, saudade consumidora ("The Sound of Silence")

5. **Euforia** [0.0–1.0]
   - 0.0 = apatia, indiferença
   - 1.0 = êxtase, celebração maníaca, peak emocional ("Happy")

6. **Tensao** [0.0–1.0]
   - 0.0 = relaxamento total, harmonia resolvida
   - 1.0 = ansiedade, dissonância irresolvida, conflito ("Smells Like Teen Spirit")

7. **ConexaoSocial** [0.0–1.0]
   - 0.0 = isolamento absoluto, monólogo interior
   - 1.0 = hinos coletivos, "nós", pertencimento

8. **Introspeccao** [0.0–1.0]
   - 0.0 = letra de festa, superficial, sem reflexão
   - 1.0 = filosofia existencial, segredos íntimos, diário ("The Sound of Silence")

9. **Empoderamento** [0.0–1.0]
   - 0.0 = derrota, vitimização
   - 1.0 = superação, autoconfiança inabalável ("Eye of the Tiger")

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

  private getMimeTypeByExt(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    return 'image/jpeg';
  }

  private resolveLocalUploadPath(facePhotoPath: string): string | null {
    const normalized = facePhotoPath.replace(/\\/g, '/');

    if (normalized.startsWith('/api/uploads/')) {
      return join(process.cwd(), normalized.replace('/api/uploads/', 'uploads/'));
    }

    if (normalized.startsWith('/uploads/')) {
      return join(process.cwd(), normalized.replace('/uploads/', 'uploads/'));
    }

    return null;
  }

  private getAllowedRemoteReferenceHosts(): Set<string> {
    const hosts = new Set<string>();

    const imageKitUrl = process.env.IMAGEKIT_URL;
    if (imageKitUrl) {
      try {
        hosts.add(new URL(imageKitUrl).host.toLowerCase());
      } catch {
        // ignora env invalida
      }
    }

    const extra = (process.env.FACE_REFERENCE_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);

    for (const host of extra) hosts.add(host);

    return hosts;
  }

  private isAllowedRemoteReference(url: URL): boolean {
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    const allowedHosts = this.getAllowedRemoteReferenceHosts();
    if (!allowedHosts.size) return false;
    return allowedHosts.has(url.host.toLowerCase());
  }

  private getMimeTypeByContentType(contentType?: string): string | null {
    if (!contentType) return null;
    const clean = contentType.split(';')[0].trim().toLowerCase();
    if (clean === 'image/png' || clean === 'image/jpeg' || clean === 'image/webp') {
      return clean;
    }
    return null;
  }

  private downloadRemoteImage(url: URL, maxBytes = 5 * 1024 * 1024, timeoutMs = 8000): Promise<{ buffer: Buffer; mimeType?: string }> {
    const client = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.get(url, (res) => {
        const status = res.statusCode ?? 0;

        if (status >= 300 && status < 400 && res.headers.location) {
          try {
            const redirectedUrl = new URL(res.headers.location, url);
            if (!this.isAllowedRemoteReference(redirectedUrl)) {
              reject(new Error('Redirect para host não permitido.'));
              return;
            }
            this.downloadRemoteImage(redirectedUrl, maxBytes, timeoutMs).then(resolve).catch(reject);
            return;
          } catch (error) {
            reject(error);
            return;
          }
        }

        if (status < 200 || status >= 300) {
          reject(new Error(`Download da referência falhou com status ${status}`));
          return;
        }

        const contentType = Array.isArray(res.headers['content-type'])
          ? res.headers['content-type'][0]
          : res.headers['content-type'];

        const chunks: Buffer[] = [];
        let total = 0;

        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            req.destroy(new Error('Imagem de referência excede tamanho máximo permitido.'));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            mimeType: this.getMimeTypeByContentType(contentType ?? undefined) ?? undefined,
          });
        });
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Timeout ao baixar imagem de referência.'));
      });

      req.on('error', reject);
    });
  }

  async genereateImage(prompt: string, facePhotoPath?: string) {
    const styleLock = `
STYLE LOCK (HIGHEST PRIORITY):
- Generate ONLY a 2D anime illustration.
- Output image MUST be exactly 768 pixels wide × 1344 pixels tall (9:16 portrait ratio).
- Never generate photorealistic, live-action, CGI-realistic, or 3D-rendered output.
- Keep medium detail and soft illustrative edges; avoid hyper-sharp texture detail.
- Do not render realistic skin pores, realistic lens effects, photographic noise, or DSLR look.
- Treat any face reference image as identity guidance only (face proportions), never as photographic texture/style source.
- If any result tends toward realism, restylize to clearly illustrated anime drawing.
`;

    const requestParts: any[] = [
      { text: styleLock.trim() },
      { text: prompt },
    ];

    if (facePhotoPath) {
      try {
        const localPath = this.resolveLocalUploadPath(facePhotoPath);
        if (localPath) {
          const fileBuffer = await fs.readFile(localPath);
          requestParts.push({
            inlineData: {
              mimeType: this.getMimeTypeByExt(localPath),
              data: fileBuffer.toString('base64'),
            },
          });
        } else {
          const remoteUrl = new URL(facePhotoPath);
          if (this.isAllowedRemoteReference(remoteUrl)) {
            const downloaded = await this.downloadRemoteImage(remoteUrl);
            const fallbackMimeType = this.getMimeTypeByExt(remoteUrl.pathname);
            requestParts.push({
              inlineData: {
                mimeType: downloaded.mimeType ?? fallbackMimeType,
                data: downloaded.buffer.toString('base64'),
              },
            });
          } else {
            console.warn('Host da imagem de referência não permitido:', remoteUrl.host);
          }
        }
      } catch (error) {
        console.warn('Falha ao carregar imagem de referência do usuário:', error);
      }
    }

    const result = await this.image_model.generateContent({
      contents: [
        {
          role: 'user',
          parts: requestParts,
        },
      ],
    });

    const response = result.response;

    const responseParts = response.candidates?.[0]?.content?.parts ?? [];

    const imagePart = responseParts.find((part: any) => part.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new Error('Nenhuma imagem foi gerada.');
    }

    const base64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    return `data:${mimeType};base64,${base64}`;
  }
}