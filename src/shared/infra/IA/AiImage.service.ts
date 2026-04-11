import { Injectable } from '@nestjs/common';
import OpenAI, { toFile } from "openai";
import { HybridPromptInput, ImagePromptService } from './ImagePrompt.service';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class AiImageService {
  private openai: OpenAI;

  constructor(private readonly imagePromptService: ImagePromptService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async buildHybridImagePrompt(input: HybridPromptInput): Promise<string> {
    return this.imagePromptService.build(input);
  }

  async generateImage(prompt: string, facePhotoPath?: string): Promise<Buffer> {
    const fullPrompt = prompt;

    let faceFile: Awaited<ReturnType<typeof toFile>> | null = null;

    if (facePhotoPath) {
      try {
        const localPath = this.resolveLocalUploadPath(facePhotoPath);

        let buffer: Buffer;
        let mimeType: string;

        if (localPath) {
          buffer = await fs.readFile(localPath);
          mimeType = this.getMimeTypeByExt(localPath);
        } else {
          const remoteUrl = new URL(facePhotoPath);
          const downloaded = await this.downloadRemoteImage(remoteUrl);
          buffer = downloaded.buffer;
          mimeType = downloaded.mimeType as string;
        }

        const ext = mimeType.split('/')[1] || 'png';
        faceFile = await toFile(buffer, `face.${ext}`, { type: mimeType });

      } catch (error) {
        console.warn('Erro ao carregar imagem:', error);
      }
    }

    let result: any;

    if (faceFile) {
      // images.edit aceita o parâmetro 'image' para referência facial
      result = await this.openai.images.edit({
        model: "gpt-image-1",
        prompt: fullPrompt,
        image: faceFile,
        size: "auto",
        input_fidelity: "low",
      });
    } else {
      result = await this.openai.images.generate({
        model: "gpt-image-1",
        prompt: fullPrompt,
        size: "auto",
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
