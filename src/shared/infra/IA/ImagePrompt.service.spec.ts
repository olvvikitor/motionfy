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

    it('o cenário vem do gênero; da música entra só o trecho da letra, como toque leve', () => {
        const prompt = service.build({
            ...base, sentiment: 'Melancolia', subgenre: 'Bossa Nova',
            song: { title: 'Wave', artist: 'Tom Jobim', lyrics: ['Vou te contar', 'Os olhos já não podem ver'] },
        });
        expect(prompt).toContain('"Vou te contar / Os olhos já não podem ver"');
        expect(prompt).not.toMatch(/Wave|Tom Jobim|Playlist title|Songs:/);
        expect(prompt).toContain('light hint for the atmosphere');
        expect(prompt).toMatch(/Brazilian city|kitchen|boardwalk|balcony/);
    });

    it('sem letra, entra o nome de uma música só', () => {
        const prompt = service.build({ ...base, sentiment: 'Paz', song: { title: 'Wave', artist: 'Tom Jobim', lyrics: [] } });
        expect(prompt).toContain('One song: "Wave" by Tom Jobim.');
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
            ...base, sentiment: 'Melancolia', subgenre: 'Bossa Nova',
            reference: { kind: 'scene', description: 'a beach at dusk with a lifeguard tower' },
        });
        expect(prompt).toContain('shows a beach at dusk with a lifeguard tower');
        expect(prompt).toContain('completely empty of people');
        expect(prompt).not.toMatch(/Brazilian city|boardwalk|balcony/); // o mundo do gênero não entra
        expect(prompt).not.toContain('Gesture:');
        expect(prompt).toContain('ligne claire');
        expect(prompt).toContain('MOOD: bittersweet nostalgia');
        expect(prompt).toMatch(/LIGHT AND COLOR: .*coming from real light sources/);
        expect(prompt).toContain('For this mood also avoid:');
        expect(prompt).toContain('Square 1:1');
    });

    it('paisagem sem ninguém: nada no prompt pede personagem, e pessoas entram no AVOID', () => {
        for (const sentiment of EMOTION_CLUSTERS) {
            for (let i = 0; i < 10; i++) {
                const prompt = service.build({ ...base, sentiment, reference: { kind: 'scene', description: 'a mountain lake' } });
                const [asked, avoided] = prompt.split('AVOID:');
                expect(asked).not.toMatch(/character is|Characters are|eyes and hands|Gesture:|the person is|\b(head|face|neck|skin|shoelaces)\b|two people/);
                expect(avoided).toMatch(/^ people of any kind/);
            }
        }
    });

    it('paisagem com gente na foto: mantém quem está nela, sem personagem novo', () => {
        const prompt = service.build({ ...base, sentiment: 'Paz', reference: { kind: 'scene', description: 'a busy market street', people: true } });
        expect(prompt).toContain('Only the people already in the photo; no new characters.');
        expect(prompt.split('AVOID:')[1]).not.toContain('people of any kind');
    });

    it('o traço da linha clara vai em toda capa, com ou sem gente', () => {
        for (let i = 0; i < 30; i++) {
            const prompt = service.build({ ...base, sentiment: 'Tristeza' });
            expect(prompt).toMatch(/^STYLE: .*ligne claire/);
            expect(prompt).toContain('black ink line of one uniform weight');
            expect(prompt).toContain('never a gradient');
            expect(prompt).not.toMatch(/Kyoto|soft diffused/);
        }
    });

    it('com foto, a troca de cada superfície pelo traço é descrita e o realismo fotográfico é proibido; sem foto, nada disso', () => {
        for (const reference of [{ kind: 'person' as const }, { kind: 'scene' as const, description: 'a mountain lake' }]) {
            const prompt = service.build({ ...base, sentiment: 'Paz', reference });
            expect(prompt).toMatch(/^TRANSFORM: convert the attached photo/);
            expect(prompt).toContain('RENDERING: every edge in the photo');
            expect(prompt.split('AVOID:')[1]).toContain('photorealism');
            expect(prompt).toMatch(/not as a photograph\.$/);
        }
        const plain = service.build({ ...base, sentiment: 'Paz' });
        expect(plain).not.toMatch(/TRANSFORM|RENDERING|photorealism/);
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
