import { Injectable } from '@nestjs/common';
import OpenAI, { toFile } from "openai";
import { CoverReference, HybridPromptInput, ImagePromptService } from './ImagePrompt.service';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import * as https from 'https';
import * as http from 'http';

export type ReferenceImage = { buffer: Buffer; mimeType: string };

type ImageQuality = 'low' | 'medium' | 'high' | 'auto';
const IMAGE_QUALITIES: ImageQuality[] = ['low', 'medium', 'high', 'auto'];

// Modelos no .env (trocar sem mexer no código); sem a variável, valem os padrões.
// OPENAI_IMAGE_MODEL: gera a capa. OPENAI_IMAGE_QUALITY: a capa vai a 640×640 no Spotify e até 1024 no card,
// "medium" não perde nada visível e custa bem menos que "high" ("auto" pode escolher "high").
// OPENAI_VISION_MODEL: só lê a foto de referência (pessoa ou cenário + descrição curta), em baixa resolução.
// Valor do .env sem espaço, quebra de linha ou aspas coladas junto (painel do Render): com uma quebra
// de linha no fim, "gpt-image-1-mini" vira um modelo que não existe e a OpenAI responde 400.
function env(name: string): string | undefined {
  return process.env[name]?.trim().replace(/^["']|["']$/g, '').trim() || undefined;
}

function imageQuality(): ImageQuality {
  const value = env('OPENAI_IMAGE_QUALITY') as ImageQuality | undefined;
  return value && IMAGE_QUALITIES.includes(value) ? value : 'medium';
}

// Tamanho da capa: o menor quadrado que o modelo aceita (custo e tempo sobem com os pixels). O gpt-image-2
// aceita qualquer tamanho múltiplo de 16 a partir de 655.360 pixels: 816×816. Os gpt-image-1* só fazem 1024×1024.
// A capa vai a 640 no Spotify e o card do perfil não amplia: 816 sobra.
function imageSize(model: string): string {
  return model.startsWith('gpt-image-2') ? '816x816' : '1024x1024';
}

@Injectable()
export class AiImageService {
  private openai: OpenAI;
  private readonly imageModel = env('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1-mini';
  private readonly imageQuality = imageQuality();
  // O SDK só tipa os tamanhos fixos dos modelos antigos.
  private readonly imageSize = imageSize(this.imageModel) as '1024x1024';
  private readonly visionModel = env('OPENAI_VISION_MODEL') ?? 'gpt-4.1-mini';

  constructor(private readonly imagePromptService: ImagePromptService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async buildHybridImagePrompt(input: HybridPromptInput): Promise<string> {
    return this.imagePromptService.build(input);
  }

  // Foto do rosto guardada no perfil (upload local ou storage permitido). Falhou, segue sem referência.
  async loadReference(facePhotoPath: string): Promise<ReferenceImage | null> {
    try {
      const localPath = this.resolveLocalUploadPath(facePhotoPath);
      if (localPath) return { buffer: await fs.readFile(localPath), mimeType: this.getMimeTypeByExt(localPath) };
      const downloaded = await this.downloadRemoteImage(new URL(facePhotoPath));
      return { buffer: downloaded.buffer, mimeType: downloaded.mimeType ?? 'image/jpeg' };
    } catch (error) {
      console.warn('Erro ao carregar imagem:', error);
      return null;
    }
  }

  // Lê a foto de referência: pessoa (selfie, retrato, amigos) ou cenário (paisagem, lugar, objeto, bicho),
  // com uma descrição curta para o prompt. Falhou, trata como cenário sem descrição: o prompt de cenário
  // manda manter o que está na foto, então uma selfie ainda sai com a pessoa.
  async describeReference(image: ReferenceImage): Promise<CoverReference> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.visionModel,
        response_format: { type: 'json_object' },
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'This photo will be the reference for an illustrated album cover. Reply only with JSON: {"kind": "person" | "scene", "people": true | false, "description": "..."}. kind is "person" when one or more people are the main subject (selfie, portrait, friends); otherwise "scene" (landscape, place, object, food, animal...). people: true if any person is visible anywhere in the photo, even small or in the background. description: what is shown, in English, at most 25 words, no names, no mood words.',
            },
            { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`, detail: 'low' } },
          ],
        }],
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as { kind?: unknown; people?: unknown; description?: unknown };
      const description = typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 200) || null : null;
      return { kind: parsed.kind === 'person' ? 'person' : 'scene', description, people: parsed.people === true };
    } catch (error) {
      console.warn('[AiImage] não deu para ler a foto de referência:', error?.message ?? error);
      return { kind: 'scene', description: null };
    }
  }

  // Capa de playlist: sempre quadrada, a mesma imagem no Spotify e no card do perfil (sem recorte).
  // Com referência (selfie, paisagem, objeto), vai pelo images.edit, que recebe a foto.
  async generateImage(prompt: string, reference?: ReferenceImage | null): Promise<Buffer> {
    let result: any;

    if (reference) {
      const ext = reference.mimeType.split('/')[1] || 'png';
      result = await this.openai.images.edit({
        model: this.imageModel,
        prompt,
        image: await toFile(reference.buffer, `reference.${ext}`, { type: reference.mimeType }),
        size: this.imageSize,
        quality: this.imageQuality,
      });
    } else {
      result = await this.openai.images.generate({
        model: this.imageModel,
        prompt,
        size: this.imageSize,
        quality: this.imageQuality,
      });
    }

    const imageBase64 = result.data[0].b64_json;

    if (!imageBase64) {
      throw new Error('Nenhuma imagem foi gerada.');
    }

    return Buffer.from(imageBase64, 'base64');
  }

  // ─── Helpers de imagem ───────────────────────────────────────

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
}
