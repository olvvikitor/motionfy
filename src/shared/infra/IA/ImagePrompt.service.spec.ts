import { EMOTION_CLUSTERS } from './emotion-analysis.service';
import { ImagePromptService } from './ImagePrompt.service';

const base = { ativacao: -0.3 };

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
        expect(prompt).toContain('MOOD: the silence before the world wakes up');
        expect(prompt).not.toMatch(/\bPaz\b|\bpeace\b/i); // o nome do humor puxa o clichê
        expect(prompt).not.toMatch(/Tensao|Tensão|dread/);
    });

    it('o cenário vem do gênero da playlist, e título e músicas entram no prompt', () => {
        const prompt = service.build({
            ...base, sentiment: 'Melancolia', title: 'Chuva de domingo',
            subgenres: ['Bossa Nova'], songs: ['Tom Jobim — Wave'],
        });
        expect(prompt).toContain('"Chuva de domingo"');
        expect(prompt).toContain('Tom Jobim — Wave');
        expect(prompt).toMatch(/Brazilian city|radio|boardwalk|balcony/);
    });

    it('com foto de referência, a composição sempre mostra a pessoa', () => {
        for (let i = 0; i < 30; i++) {
            const prompt = service.build({ ...base, sentiment: 'Paz', faceReferencePath: '/uploads/me.jpg' });
            expect(prompt).not.toContain('No people');
            expect(prompt).toContain('reference photo');
        }
    });

    it('Celebração: fogos de artifício só aparecem como proibição', () => {
        for (let i = 0; i < 50; i++) {
            const prompt = service.build({ ...base, sentiment: 'Celebracao' });
            const [asked, avoided] = prompt.split('AVOID:');
            expect(asked).not.toMatch(/firework|confetti|balloon/i);
            expect(avoided).toMatch(/fireworks/);
        }
    });

    it('todo humor proíbe os próprios clichês e varia a paleta', () => {
        for (const sentiment of EMOTION_CLUSTERS) {
            const prompts = Array.from({ length: 40 }, () => service.build({ ...base, sentiment }));
            prompts.forEach(p => expect(p).toContain('For this mood also avoid:'));
            const palettes = new Set(prompts.map(p => p.match(/LIGHT AND COLOR: (.*?), coming from/)![1]));
            expect(palettes.size).toBeGreaterThan(1);
        }
    });
});
