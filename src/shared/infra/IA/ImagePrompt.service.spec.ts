import { ImagePromptService } from './ImagePrompt.service';

const base = { moodScore: 0.8, ativacao: -0.3, coreAxes: { polaridade: 0.5, ativacao: -0.3 } as never };

describe('ImagePromptService', () => {
    const service = new ImagePromptService();

    it('arte de playlist: 9:16 com o essencial no centro (vira capa 1:1 por recorte)', () => {
        const prompt = service.build({ ...base, sentiment: 'Paz', format: 'cover' });
        expect(prompt).toContain('Retrato 9:16');
        expect(prompt).toContain('recortada em quadrado');
    });

    it('arte do humor: 9:16, sem a regra de recorte', () => {
        const prompt = service.build({ ...base, sentiment: 'Paz' });
        expect(prompt).toContain('Retrato 9:16');
        expect(prompt).not.toContain('recortada em quadrado');
    });

    it('usa só o humor recebido (o final da jornada), sem outro humor no tema', () => {
        const prompt = service.build({ ...base, sentiment: 'Paz', format: 'cover' });
        expect(prompt).toContain('Tema: "Paz"');
        expect(prompt).not.toMatch(/Tensao|Tensão|mente a mil/);
    });
});
