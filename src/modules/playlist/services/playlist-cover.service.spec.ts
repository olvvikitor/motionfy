import sharp from 'sharp';
import { toProfileArt, toSpotifyCover } from './playlist-cover.service';

// Imagem com ruído (difícil de comprimir), no tamanho que a IA devolve.
async function noisyPng(width: number, height: number): Promise<Buffer> {
    const pixels = Buffer.alloc(width * height * 3);
    for (let i = 0; i < pixels.length; i++) pixels[i] = Math.floor(Math.random() * 256);
    return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe('toSpotifyCover', () => {
    it('devolve JPEG quadrado 640×640 dentro do limite de 256 KB do Spotify', async () => {
        const base64 = await toSpotifyCover(await noisyPng(1024, 1536));
        expect(base64.length).toBeLessThanOrEqual(256 * 1024);

        const meta = await sharp(Buffer.from(base64, 'base64')).metadata();
        expect(meta.format).toBe('jpeg');
        expect(meta.width).toBe(640);
        expect(meta.height).toBe(640);
    });

    it('arte do perfil mantém o 9:16 da imagem gerada (só reduz se for maior que 1080×1920)', async () => {
        const art = await toProfileArt(await noisyPng(1024, 1536));
        const meta = await sharp(art).metadata();
        expect(meta.format).toBe('jpeg');
        expect(meta.width! / meta.height!).toBeCloseTo(1024 / 1536, 2);
    });

    it('recusa arquivo que não é imagem', async () => {
        await expect(toSpotifyCover(Buffer.from('não é imagem'))).rejects.toThrow();
    });
});
