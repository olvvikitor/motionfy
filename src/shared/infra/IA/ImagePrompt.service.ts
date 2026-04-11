import { Injectable } from "@nestjs/common";
import { CoreAxes } from "./emotion-analysis.service";

type StudioStyle = {
    id: string;
    name: string;
    company: string;
    logoKey: string;
    referenceAnimes: string[];
    visualLanguage: string;
    cinematography: string;
    motionStyle: string;
    renderingNotes: string;
};

export type StudioStyleOption = Pick<StudioStyle, "id" | "name" | "company" | "logoKey" | "referenceAnimes" | "visualLanguage" | "cinematography" | "motionStyle" | "renderingNotes">;

export type HybridPromptInput = {
    moodScore: number;
    sentiment: string;
    ativacao: number;
    coreAxes: CoreAxes;
    emotions?: any;
    faceReferencePath?: string | null;
    studioId?: string;
};

// ── Quadrantes emocionais ─────────────────────────────────────────────────────
type Quadrant = "PositivoAtivo" | "PositivoCalmo" | "NegativoAtivo" | "NegativoCalmo" | "Centro";

const MOOD_TO_QUADRANT: Record<string, Quadrant> = {
    Euforia:    "PositivoAtivo",
    Celebracao: "PositivoAtivo",
    Confianca:  "PositivoAtivo",
    Energia:    "PositivoAtivo",
    Amor:       "PositivoCalmo",
    Paz:        "PositivoCalmo",
    Reflexao:   "PositivoCalmo",
    Tensao:     "NegativoAtivo",
    Revolta:    "NegativoAtivo",
    Frustracao: "NegativoAtivo",
    Melancolia: "NegativoCalmo",
    Tristeza:   "NegativoCalmo",
    Vazio:      "NegativoCalmo",
    Ambivalente: "Centro",
};

// ── DNA da cena por estúdio e quadrante (condensado: 1 linha por item) ───────
type SceneDNA = { scenario: string; motion: string; camera: string };

const STUDIO_SCENE_DNA: Record<string, Record<Quadrant, SceneDNA>> = {
    kyoani: {
        PositivoAtivo: { scenario: "festival escolar ensolarado, cerejeiras, luz quente de fim de tarde", motion: "girando de alegria, saia esvoaçando, olhos brilhantes", camera: "plano médio, bokeh quente de lanternas ao fundo" },
        PositivoCalmo: { scenario: "café silencioso junto a janela com chuva, chá fumegando", motion: "lendo em silêncio, leve sorriso, fones no pescoço", camera: "close-up íntimo, fundo suavemente desfocado" },
        NegativoAtivo: { scenario: "entrada da escola na chuva, alunos apressados, uma figura parada", motion: "segurando a maçaneta sem abrir, dedos tensos", camera: "close-up nas mãos, emoção lida pela tensão" },
        NegativoCalmo: { scenario: "terraço vazio ao entardecer, cidade sumindo na distância", motion: "encostada na parede, joelhos para cima, rosto virado", camera: "recuo de close para plano aberto, solidão no quadro" },
        Centro: { scenario: "terraço da escola entre aulas, vento passando, cidade abaixo", motion: "peso mudando entre os pés, olhando em duas direções", camera: "composição simétrica, personagem centralizada" },
    },
    ghibli: {
        PositivoAtivo: { scenario: "voando acima das nuvens em criatura espiritual, sol rompendo", motion: "braços abertos em voo livre, cabelo ao vento, pura alegria", camera: "plano aberto de baixo, personagem contra vasto céu azul" },
        PositivoCalmo: { scenario: "campo de flores na hora dourada, cabana no vale", motion: "deitada na grama olhando nuvens, mão trilhando o prado", camera: "panorâmico de estabelecimento, personagem minúscula em repouso" },
        NegativoAtivo: { scenario: "tempestade sobre cidade costeira, mar agitado, venezianas batendo", motion: "firme contra vento poderoso, cabelo e casaco em movimento", camera: "plano aberto da escala hostil ao redor de figura pequena" },
        NegativoCalmo: { scenario: "santuário abandonado em floresta de inverno, neve sobre torii", motion: "sentada em degraus olhando pétalas caindo", camera: "recuo amplo revelando vazio ao redor da personagem" },
        Centro: { scenario: "balsa entre dois mundos, ambas as margens visíveis, água calma", motion: "na grade da balsa, sem olhar para nenhuma margem", camera: "simetria perfeita, ambos os mundos espelhados" },
    },
    ufotable: {
        PositivoAtivo: { scenario: "noble phantasm ativado, realidade fraturando em luz dourada", motion: "arma erguida, círculos mágicos desabrochando sob os pés", camera: "arco amplo 3D em figura triunfante, céu imenso" },
        PositivoCalmo: { scenario: "santuário sob luar após a batalha, torii projetando sombras", motion: "embainhando arma lentamente, olhos fechando em alívio", camera: "push-in lento em expressão composta sob luz mágica" },
        NegativoAtivo: { scenario: "erupção de linha ley rachando a cidade, luz e sombra em batalha", motion: "invocando noble phantasm, ar distorcendo ao redor", camera: "câmera em arco enquanto energia explode" },
        NegativoCalmo: { scenario: "igreja em ruínas após batalha, vitrais quebrados, luar sobre escombros", motion: "ajoelhado com mão no chão, forças quase esgotadas", camera: "recuo de close íntimo para vasto espaço vazio" },
        Centro: { scenario: "floresta no crepúsculo, nem dia nem noite, magia suspensa", motion: "mãos entrelaçadas, olhos fechados, sem decisão, momento suspenso", camera: "órbita lenta ao redor de figura imóvel em espaço liminar" },
    },
    mappa: {
        PositivoAtivo: { scenario: "terraço de Tóquio à noite, neon encharcando concreto molhado", motion: "punho erguido após luta, suor e euforia, multidão atrás", camera: "crash zoom na expressão triunfante, bokeh urbano" },
        PositivoCalmo: { scenario: "izakaya, luz âmbar quente, duas pessoas após dia difícil", motion: "recostado com latinha, olhando a cidade pela grade", camera: "plano médio íntimo com fundo urbano texturizado" },
        NegativoAtivo: { scenario: "domínio colapsando Shibuya, energia amaldiçoada rasgando o ar", motion: "Black Flash — tempo fractalizado, punho no impacto", camera: "freeze-frame de impacto: parada total, close-up extremo" },
        NegativoCalmo: { scenario: "academia vazia às 4h, uma luz no teto, saco de pancadas balançando", motion: "sentado no banco, cabeça baixa, antebraços nos joelhos", camera: "close-up nas mãos entre os joelhos, rosto mal visível" },
        Centro: { scenario: "plataforma de trem à meia-noite, trem ao longe, decisão pendente", motion: "celular na mão, mensagem não enviada, polegar pairando", camera: "plano simétrico, personagem como eixo entre dois mundos" },
    },
    shaft: {
        PositivoAtivo: { scenario: "arquitetura impossível estilhaçando em fragmentos geométricos coloridos", motion: "cabeça inclinada em ângulo impossível, sorriso quebrando a composição", camera: "zoom espiral centrado, geometria se desdobrando" },
        PositivoCalmo: { scenario: "estantes ao infinito em luz âmbar, escala e quietude impossíveis", motion: "sentada em espaço branco, lendo algo que só ela vê", camera: "plano longuíssimo, personagem um glifo em espaço infinito" },
        NegativoAtivo: { scenario: "corredor surreal inclinando para ponto de fuga sem destino", motion: "inclinação de cabeça a 90°, olho travado no espectador", camera: "ângulo holandês extremo 45°, nada horizontal no quadro" },
        NegativoCalmo: { scenario: "corredor infinito monocromático, uma janela acesa", motion: "imóvel encarando câmera, expressão sem afeto", camera: "plano frontal travado, zero movimento, composição formal" },
        Centro: { scenario: "escadaria impossível subindo e descendo sem diferença", motion: "mãos cruzadas no colo, perfeitamente imóvel, nem sim nem não", camera: "quadro dividido, metades fazendo coisas diferentes" },
    },
    trigger: {
        PositivoAtivo: { scenario: "cabine mecha em sincronização máxima, galáxia espiral à frente", motion: "apontando para o céu, capa explodindo, proporções impossíveis", camera: "zoom espiral para close-up extremo, linhas de energia" },
        PositivoCalmo: { scenario: "pôr do sol impossivelmente saturado, céu além da física", motion: "recostado na encosta, braços atrás da cabeça, calma total", camera: "silhueta contra gradiente saturado, energia de design gráfico" },
        NegativoAtivo: { scenario: "cidade sob ataque espiral, prédios cisalhando, céu rachando", motion: "carga total para frente, smear frames, linhas de velocidade", camera: "ângulo holandês rotativo com crash zoom, caos cinético" },
        NegativoCalmo: { scenario: "rescaldo de batalha mecha, ajoelhado em destroços, céu clareando", motion: "sentado nos escombros, mãos no colo, olhos fechados, em paz", camera: "grua aberta revelando escala do rescaldo, figura imóvel" },
        Centro: { scenario: "encruzilhada entre dois mundos impossíveis, ambos totais", motion: "braços abertos, peso em um pé, sem comprometer próximo movimento", camera: "rotação que nunca para, mundo ciclando ao redor" },
    },
};

// ── Nuance emocional (condensada: 1 paleta, 1 atmosfera, 1 símbolo) ──────────
type MoodNuance = { palette: string; atmosphere: string; symbol: string };

const MOOD_NUANCE: Record<string, MoodNuance> = {
    Euforia:     { palette: "amarelo elétrico e âmbar sobre sombra profunda, bloom luminoso", atmosphere: "tempo suspenso em seu momento mais vivo", symbol: "fogos de artifício em plena explosão" },
    Celebracao:  { palette: "coral vívido e ouro quente com luz de celebração saturada", atmosphere: "alegria compartilhada, eletricidade de pertencer à multidão", symbol: "multidão de amigos em silhueta contra fogos, confete e luz" },
    Confianca:   { palette: "azul aço frio e lima sobre quase-preto", atmosphere: "autoridade silenciosa que não precisa de anúncio", symbol: "cidade refletida em lentes, sombras geométricas alinhadas" },
    Energia:     { palette: "laranja industrial e ciano bruto sobre asfalto preto", atmosphere: "física no limite humano, potencial cinético", symbol: "linhas de rachadura a partir de ponto de impacto" },
    Amor:        { palette: "rosa corado e marfim em difusão suave de manhã", atmosphere: "tempo no ritmo de um batimento cardíaco", symbol: "flores prensadas e vela suave" },
    Paz:         { palette: "verde-espuma e azul celeste pálido sobre luz creme", atmosphere: "silêncio antes de o mundo acordar", symbol: "pena flutuando no ar parado" },
    Reflexao:    { palette: "índigo profundo e lavanda com brilho estelar", atmosphere: "pergunta sem resposta, memória e presente se misturando", symbol: "estrelas espelhadas em poça parada" },
    Tensao:      { palette: "verde-amarelo fluorescente sobre sombra fria", atmosphere: "pavor de algo não dito e inevitável", symbol: "espelho rachado em banheiro escuro" },
    Revolta:     { palette: "vermelho-sangue e obsidiana com rim light agressiva", atmosphere: "raiva rompida, destruição como linguagem", symbol: "concreto estilhaçado com vergalhão exposto" },
    Frustracao:  { palette: "âmbar enlameado e carvão com luz agressiva de cima", atmosphere: "atrito entre o que deveria ser e o que é", symbol: "relógio cujos ponteiros se recusam a mover" },
    Melancolia:  { palette: "azul-aço suave e lavanda em luz de neblina", atmosphere: "nostalgia desgastada pelo tempo, agridoce", symbol: "guarda-chuva esquecido num banco na chuva" },
    Tristeza:    { palette: "ardósia profunda e estanho sobre quase-preto", atmosphere: "luto que se acomodou e não vai embora", symbol: "cadeira vazia em mesa posta" },
    Vazio:       { palette: "cinza-concreto e branco desbotado, sem calor", atmosphere: "estática entre estações, sinal perdido", symbol: "tela em branco refletindo um rosto" },
    Ambivalente: { palette: "bicolor: âmbar quente de um lado, azul frio do outro", atmosphere: "momento suspenso entre dois futuros diferentes", symbol: "porta entreaberta com luz diferente de cada lado" },
};

// ── Modificador de ativação (condensado) ─────────────────────────────────────
function activationModifier(ativacao: number): string {
    if (ativacao >  0.6) return "ENERGIA ALTA: motion blur, ângulos dinâmicos, tempo comprimido.";
    if (ativacao >  0.2) return "ENERGIA MODERADA: ambiente em movimento, personagem engajada.";
    if (ativacao > -0.2) return "ENERGIA EQUILIBRADA: movimentos sutis, personagem composta.";
    if (ativacao > -0.6) return "ENERGIA BAIXA: lento e contemplativo, personagem absorvida.";
    return                      "QUASE ESTÁTICO: imóvel. Poeira num feixe de luz. Quietude é o tema.";
}

// ── Estilos dos estúdios (descrições condensadas) ────────────────────────────
const STUDIO_STYLES: StudioStyle[] = [
    {
        id: "kyoani", name: "Kyoto Animation", company: "Kyoto Animation", logoKey: "kyoani",
        referenceAnimes: ["Violet Evergarden", "K-On!", "Hyouka", "A Silent Voice", "Clannad After Story"],
        visualLanguage: "iluminação difusa pastel, olhos expressivos, micro-expressões, realismo emocional slice-of-life",
        cinematography: "enquadramento estável, close-ups íntimos, foco na atuação acima do espetáculo",
        motionStyle: "fluida e sutil — olhos, respiração, balanço do cabelo — alta consistência",
        renderingNotes: "anatomia meticulosa, iluminação realista, ambientes cotidianos ricos e suaves",
    },
    {
        id: "ghibli", name: "Studio Ghibli", company: "Studio Ghibli", logoKey: "ghibli",
        referenceAnimes: ["Spirited Away", "Howl's Moving Castle", "Princess Mononoke", "The Wind Rises", "My Neighbor Totoro"],
        visualLanguage: "fundos aquarelados, texturas orgânicas, designs simples e expressivos, nostálgico e onírico",
        cinematography: "planos cênicos amplos, ritmo lento e contemplativo, atmosfera e imersão",
        motionStyle: "movimento com peso natural, física crível mesmo na fantasia",
        renderingNotes: "pinceladas visíveis, sensação cel tradicional, conexão personagem-natureza",
    },
    {
        id: "ufotable", name: "Ufotable", company: "ufotable", logoKey: "ufotable",
        referenceAnimes: ["Fate/stay night UBW", "Demon Slayer", "Kara no Kyoukai"],
        visualLanguage: "iluminação cinematográfica, alto contraste, efeitos de partículas (brasas, faíscas), profundidade de campo",
        cinematography: "câmera dinâmica, ângulos amplos 3D, planos cinematográficos",
        motionStyle: "suave mas impactante, antecipação dramática, precisão em VFX",
        renderingNotes: "composição polida, iluminação volumétrica, forte estratificação de profundidade",
    },
    {
        id: "mappa", name: "Studio MAPPA", company: "MAPPA", logoKey: "mappa",
        referenceAnimes: ["Jujutsu Kaisen", "Chainsaw Man", "Attack on Titan Final Season"],
        visualLanguage: "contraste cinematográfico, textura urbana áspera, emoção facial intensa, anatomia com impacto dramático",
        cinematography: "câmera dinâmica controlada, silhuetas fortes, profundidade atmosférica sombria",
        motionStyle: "movimento pesado e impactante, poses-chave marcadas, alta tensão",
        renderingNotes: "sombras ricas, fundos texturizados, separação dramática de cores, realismo sem fotorrealismo",
    },
    {
        id: "shaft", name: "Studio Shaft", company: "Shaft", logoKey: "shaft",
        referenceAnimes: ["Bakemonogatari", "Madoka Magica", "March Comes in Like a Lion"],
        visualLanguage: "composição avant-garde, blocos de cor ousados, fundos abstratos/simbólicos, minimalismo gráfico",
        cinematography: "ângulos extremos, inclinações de cabeça, cortes rápidos, espaço negativo pesado",
        motionStyle: "animação limitada estilística — composição e ritmo gráfico acima de fluidez",
        renderingNotes: "encenação surreal, imagética simbólica, narrativa experimental — forma serve psicologia",
    },
    {
        id: "trigger", name: "Studio Trigger", company: "Studio Trigger", logoKey: "trigger",
        referenceAnimes: ["Kill la Kill", "Promare", "Cyberpunk Edgerunners", "Gurren Lagann"],
        visualLanguage: "linework ousado, cor saturada ao máximo, proporções exageradas, design expressivo extremo",
        cinematography: "cortes rápidos, zooms extremos, enquadramento dinâmico impossível, alta energia",
        motionStyle: "hipercinética, smear frames, deformação expressiva — caos intencional legível",
        renderingNotes: "silhuetas fortes, contraste máximo, deformação expressiva sobre realismo",
    },
];

@Injectable()
export class ImagePromptService {

    build(data: HybridPromptInput) {
        const studio   = this.getStudioStyle(data.studioId);
        const refAnime = this.random(studio.referenceAnimes);
        const moodKey  = this.normalizeMoodKey(data.sentiment);
        const quadrant = MOOD_TO_QUADRANT[moodKey] ?? "Centro";
        const dna      = STUDIO_SCENE_DNA[studio.id]?.[quadrant];
        const nuance   = MOOD_NUANCE[moodKey];
        const actMod   = activationModifier(data.ativacao ?? 0);

        const scenario  = dna    ? dna.scenario     : "ambiente evocativo";
        const motion    = dna    ? dna.motion        : "pose emocional deliberada";
        const camera    = dna    ? dna.camera         : "plano médio deliberado";
        const palette   = nuance ? nuance.palette     : "gradação cinematográfica rica";
        const atmosphere= nuance ? nuance.atmosphere  : "carregado de emoção não dita";
        const symbol    = nuance ? nuance.symbol      : "detalhe visual significativo";

        const celebrationRule = moodKey === "Celebracao"
            ? "\nREGRA: Celebração social. Multidão/grupo em ápice de alegria (festival, show, vitória). SEM comida/mesas/banquetes. Energia vem de PESSOAS: luzes, confete, fogos, palcos."
            : "";

        const faceRef = data.faceReferencePath
            ? "Traduzir identidade facial da referência para o estilo do estúdio. Sem fotorrealismo."
            : "Personagem jovem adulto(a) original.";

        return `Ilustração 2D anime no estilo ${studio.name} (ref: ${refAnime}). Tema: "${data.sentiment}".

ESTÚDIO: ${studio.visualLanguage}. ${studio.cinematography}. ${studio.motionStyle}. ${studio.renderingNotes}.

CENA: ${scenario}. POSE: ${motion}. CÂMERA: ${camera}.

EMOÇÃO "${data.sentiment}": Paleta: ${palette}. Atmosfera: ${atmosphere}. Símbolo: ${symbol}. ${actMod}${celebrationRule}

PERSONAGEM: ${faceRef}

SAÍDA: Retrato 9:16, ilustração 2D anime estilizada. NUNCA fotorrealista. Sem texto/tipografia. Reconhecível como ${studio.company}.`.trim();
    }

    getAvailableStudios(): StudioStyleOption[] {
        return STUDIO_STYLES.map(({ id, name, company, logoKey, referenceAnimes, visualLanguage, cinematography, motionStyle, renderingNotes }) =>
            ({ id, name, company, logoKey, referenceAnimes, visualLanguage, cinematography, motionStyle, renderingNotes }));
    }

    private getStudioStyle(studioId?: string): StudioStyle {
        const id = studioId?.trim().toLowerCase() ?? "trigger";
        return STUDIO_STYLES.find(s => s.id === id) ?? STUDIO_STYLES.find(s => s.id === "trigger")!;
    }

    private normalizeMoodKey(sentiment?: string): string {
        if (!sentiment) return "Ambivalente";
        const keys = Object.keys(MOOD_TO_QUADRANT);
        return keys.find(k => k.toLowerCase() === sentiment.toLowerCase()) ?? "Ambivalente";
    }

    private random<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}