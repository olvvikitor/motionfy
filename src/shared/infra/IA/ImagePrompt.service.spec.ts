import { EMOTION_CLUSTERS } from './emotion-analysis.service';
import { ImagePromptService } from './ImagePrompt.service';

const base = { ativacao: -0.3 };

describe('ImagePromptService', () => {
    const service = new ImagePromptService();

    it('capa de playlist: quadrada, mostrada inteira (sem recorte)', () => {
        const prompt = service.build({ ...base, sentiment: 'Paz' });
        expect(prompt).toContain('Square 1:1');
        expect(prompt).not.toContain('9:16');
    });

    it('usa só o humor recebido (o final da jornada), sem outro humor no tema', () => {
        const prompt = service.build({ ...base, sentiment: 'Paz' });
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
            const prompt = service.build({ ...base, sentiment: 'Paz', reference: { kind: 'person' } });
            expect(prompt).not.toContain('No people');
            expect(prompt).toContain('reference photo');
        }
    });

    it('com paisagem/objeto, a foto é o cenário e o resto da direção é o mesmo', () => {
        const prompt = service.build({
            ...base, sentiment: 'Melancolia', subgenres: ['Bossa Nova'],
            reference: { kind: 'scene', description: 'a beach at dusk with a lifeguard tower' },
        });
        expect(prompt).toContain('shows a beach at dusk with a lifeguard tower');
        expect(prompt).toContain('no new characters');
        expect(prompt).not.toMatch(/Brazilian city|boardwalk|balcony/); // o mundo do gênero não entra
        expect(prompt).not.toContain('Gesture:');
        expect(prompt).toContain('Kyoto Animation');
        expect(prompt).toContain('MOOD: bittersweet nostalgia');
        expect(prompt).toMatch(/LIGHT AND COLOR: .*coming from real light sources/);
        expect(prompt).toContain('For this mood also avoid:');
        expect(prompt).toContain('Square 1:1');
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
