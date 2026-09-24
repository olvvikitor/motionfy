import { Injectable } from "@nestjs/common";
import { CoreAxes } from "./emotion-analysis.service";

type StudioStyle = {
    name: string;
    company: string;
    referenceAnimes: string[];
    visualLanguage: string;
    cinematography: string;
    motionStyle: string;
    renderingNotes: string;
};

export type HybridPromptInput = {
    moodScore: number;
    sentiment: string;
    ativacao: number;
    coreAxes: CoreAxes;
    emotions?: any;
    faceReferencePath?: string | null;
    topGenre?: string;
    currentSong?: string;
};

// ── Quadrantes emocionais ─────────────────────────────────────────────────────
type Quadrant = "PositivoAtivo" | "PositivoCalmo" | "NegativoAtivo" | "NegativoCalmo" | "Centro";

const MOOD_TO_QUADRANT: Record<string, Quadrant> = {
    Euforia: "PositivoAtivo",
    Celebracao: "PositivoAtivo",
    Confianca: "PositivoAtivo",
    Energia: "PositivoAtivo",
    Amor: "PositivoCalmo",
    Paz: "PositivoCalmo",
    Reflexao: "PositivoCalmo",
    Tensao: "NegativoAtivo",
    Revolta: "NegativoAtivo",
    Frustracao: "NegativoAtivo",
    Melancolia: "NegativoCalmo",
    Tristeza: "NegativoCalmo",
    Vazio: "NegativoCalmo",
    Ambivalente: "Centro",
};

// ── DNA da cena por quadrante (múltiplas variações) ───────
type SceneDNA = { scenario: string; motion: string; camera: string };
// Todas as artes seguem o estilo Kyoto Animation.
const SCENE_DNA: Record<Quadrant, SceneDNA[]> = {
    PositivoAtivo: [
        { scenario: "festival escolar ensolarado, cerejeiras, luz quente de fim de tarde", motion: "girando de alegria, saia esvoaçando, olhos brilhantes", camera: "plano médio, bokeh quente de lanternas ao fundo" },
        { scenario: "praia no verão, brisa no cabelo, céu azul cristalino", motion: "correndo em direção à água, rindo alto e convidativamente", camera: "plano dinâmico acompanhando o ritmo, luz solar estourada ao fundo" },
        { scenario: "sala de clube musical, tarde dourada, poeira visível no raio de sol", motion: "tocando instrumento invisível com empolgação total", camera: "close-up em sorriso afetuoso, profundidade de campo rasa" },
        { scenario: "festival de fogos de artifício no verão, vestindo yukata com estampas florais", motion: "olhando maravilhada para o céu colorido, mãos unidas", camera: "low angle da personagem com os fogos iluminando seus olhos vivos" },
        { scenario: "sala de aula iluminada pela manhã, lousa ao fundo, amigos ao redor", motion: "sorrindo amplamente e acenando para alguém que entra", camera: "foco suave e quente, transição fluida de movimento" }
    ],
    PositivoCalmo: [
        { scenario: "café silencioso junto a janela com chuva, chá fumegando", motion: "lendo em silêncio, leve sorriso, fones no pescoço", camera: "close-up íntimo, fundo suavemente desfocado" },
        { scenario: "biblioteca antiga, raio de luz iluminando poeira no ar", motion: "folheando página gentilmente, olhar sereno e focado", camera: "plano médio de perfil, paleta quente de madeira" },
        { scenario: "varanda de casa, final da tarde, brisa fresca de outono", motion: "espreguiçando-se suavemente, olhos fechados desfrutando o momento", camera: "plano contido e pacífico, simetria relaxante" },
        { scenario: "ônibus vazio ao entardecer viajando por áreas rurais", motion: "encostada na janela ouvindo música suave, brisa no cabelo", camera: "tracking shot de perfil com reflexo dourado leve" },
        { scenario: "jardim tradicional japonês com lago e carpas, sombra de árvore", motion: "alimentando peixes devagar em total paz", camera: "planos detalhados em pés e mãos com luz pastel" }
    ],
    NegativoAtivo: [
        { scenario: "entrada da escola na chuva, alunos apressados, chuva pesada", motion: "segurando a maçaneta sem abrir, dedos tensos", camera: "close-up nas mãos, emoção lida pela tensão e gotas d'água" },
        { scenario: "cruzamento urbano noturno, luzes de neon desfocadas", motion: "correndo desesperadamente, chorando com força, respiração ofegante", camera: "seguir no nível dos olhos, câmera na mão levemente instável" },
        { scenario: "corredor escuro da escola após o pôr do sol", motion: "batendo no armário com frustração crua, lágrimas caindo", camera: "plano focado nas costas tensionadas e respiração" },
        { scenario: "ponte sobre rio agitado sob tempestade repentina", motion: "gritando contra o vento enquanto tenta segurar um guarda-chuva quebrado", camera: "câmera tremida pelo vento, foco dramático nos olhos marejados" },
        { scenario: "quarto desarrumado durante uma discussão no telefone", motion: "jogando travesseiros com raiva frustrada, rosto corado de indignação", camera: "câmera nível dos olhos com desfoque de movimento forte" }
    ],
    NegativoCalmo: [
        { scenario: "terraço vazio ao entardecer, cidade sumindo na luz violeta", motion: "encostada na parede, joelhos recolhidos, rosto virado", camera: "recuo de close para plano aberto isolado" },
        { scenario: "quarto escuro de madrugada, única luz pálida da lua", motion: "encarando o teto sem piscar, olhar perdido e vazio", camera: "top-down shot vertical, figura pequena cercada de sombras" },
        { scenario: "vagão de trem vazio à noite, luzes ritmadas da cidade passando", motion: "encostado no vidro frio, suspirando silenciosamente", camera: "foco profundo no reflexo transparente no vidro da janela" },
        { scenario: "sala de aula após todos irem embora, carteiras arrumadas", motion: "sentada na última fileira desenhando sem vontade, olhar distante", camera: "plano longo que acentua o espaço e o silêncio" },
        { scenario: "janela do quarto num dia de neve silenciosa à noite", motion: "dedo traçando linhas no vidro embaçado, expressão apática", camera: "close up na mão e vidro com profundidade de campo muito rasa" }
    ],
    Centro: [
        { scenario: "terraço da escola entre aulas, vento contínuo, nuvens rápidas", motion: "peso mudando de um pé pro outro, olhando pra baixo em ponderação", camera: "composição passiva centrada" },
        { scenario: "caminhando para a escola sob luz banal da manhã", motion: "passos ritmados, olhar à frente sem pensar muito", camera: "acompanhamento lateral plano" },
        { scenario: "banco de praça em tarde nublada banal, pombos no asfalto", motion: "olhando para um celular desbloqueado sem ler nada", camera: "ângulo fixo frontal distante, sem julgamento visual" },
        { scenario: "cruzamento de trem do subúrbio enquanto a catraca abaixa", motion: "esperando o trem passar com postura reta e inexpressiva", camera: "plano detalhe do rosto cortado pela luz ritmada dos vagões" }
    ],
};

// ── Nuance emocional (condensada: 1 paleta, 1 atmosfera, 1 símbolo) ──────────
type MoodNuance = { palette: string; atmosphere: string; symbol: string };

const MOOD_NUANCE: Record<string, MoodNuance> = {
    Euforia: { palette: "amarelo elétrico e âmbar sobre sombra profunda, bloom luminoso", atmosphere: "tempo suspenso em seu momento mais vivo", symbol: "fogos de artifício em plena explosão" },
    Celebracao: { palette: "coral vívido e ouro quente com luz de celebração saturada", atmosphere: "alegria compartilhada, eletricidade de pertencer à multidão", symbol: "multidão de amigos em silhueta contra fogos, confete e luz" },
    Confianca: { palette: "azul aço frio e lima sobre quase-preto", atmosphere: "autoridade silenciosa que não precisa de anúncio", symbol: "cidade refletida em lentes, sombras geométricas alinhadas" },
    Energia: { palette: "laranja industrial e ciano bruto sobre asfalto preto", atmosphere: "física no limite humano, potencial cinético", symbol: "linhas de rachadura a partir de ponto de impacto" },
    Amor: { palette: "rosa corado e marfim em difusão suave de manhã", atmosphere: "tempo no ritmo de um batimento cardíaco", symbol: "flores prensadas e vela suave" },
    Paz: { palette: "verde-espuma e azul celeste pálido sobre luz creme", atmosphere: "silêncio antes de o mundo acordar", symbol: "pena flutuando no ar parado" },
    Reflexao: { palette: "índigo profundo e lavanda com brilho estelar", atmosphere: "pergunta sem resposta, memória e presente se misturando", symbol: "estrelas espelhadas em poça parada" },
    Tensao: { palette: "verde-amarelo fluorescente sobre sombra fria", atmosphere: "pavor de algo não dito e inevitável", symbol: "espelho rachado em banheiro escuro" },
    Revolta: { palette: "vermelho-sangue e obsidiana com rim light agressiva", atmosphere: "raiva rompida, destruição como linguagem", symbol: "concreto estilhaçado com vergalhão exposto" },
    Frustracao: { palette: "âmbar enlameado e carvão com luz agressiva de cima", atmosphere: "atrito entre o que deveria ser e o que é", symbol: "relógio cujos ponteiros se recusam a mover" },
    Melancolia: { palette: "azul-aço suave e lavanda em luz de neblina", atmosphere: "nostalgia desgastada pelo tempo, agridoce", symbol: "guarda-chuva esquecido num banco na chuva" },
    Tristeza: { palette: "ardósia profunda e estanho sobre quase-preto", atmosphere: "luto que se acomodou e não vai embora", symbol: "cadeira vazia em mesa posta" },
    Vazio: { palette: "cinza-concreto e branco desbotado, sem calor", atmosphere: "estática entre estações, sinal perdido", symbol: "tela em branco refletindo um rosto" },
    Ambivalente: { palette: "bicolor: âmbar quente de um lado, azul frio do outro", atmosphere: "momento suspenso entre dois futuros diferentes", symbol: "porta entreaberta com luz diferente de cada lado" },
};

// ── Modificador de ativação (condensado) ─────────────────────────────────────
function activationModifier(ativacao: number): string {
    if (ativacao > 0.6) return "ENERGIA ALTA: motion blur, ângulos dinâmicos, tempo comprimido.";
    if (ativacao > 0.2) return "ENERGIA MODERADA: ambiente em movimento, personagem engajada.";
    if (ativacao > -0.2) return "ENERGIA EQUILIBRADA: movimentos sutis, personagem composta.";
    if (ativacao > -0.6) return "ENERGIA BAIXA: lento e contemplativo, personagem absorvida.";
    return "QUASE ESTÁTICO: imóvel. Poeira num feixe de luz. Quietude é o tema.";
}

// ── Estilo do estúdio (Kyoto Animation) ──────────────────────────────────────
const STUDIO: StudioStyle = {
    name: "Kyoto Animation", company: "Kyoto Animation",
    referenceAnimes: ["Violet Evergarden", "K-On!", "Hyouka", "A Silent Voice", "Clannad After Story"],
    visualLanguage: "iluminação difusa pastel, olhos expressivos, micro-expressões, realismo emocional slice-of-life",
    cinematography: "enquadramento estável, close-ups íntimos, foco na atuação acima do espetáculo",
    motionStyle: "fluida e sutil — olhos, respiração, balanço do cabelo — alta consistência",
    renderingNotes: "anatomia meticulosa, iluminação realista, ambientes cotidianos ricos e suaves",
};

@Injectable()
export class ImagePromptService {

    build(data: HybridPromptInput) {
        const studio = STUDIO;
        const refAnime = this.random(studio.referenceAnimes);
        const moodKey = this.normalizeMoodKey(data.sentiment);
        const quadrant = MOOD_TO_QUADRANT[moodKey] ?? "Centro";
        const dnaList = SCENE_DNA[quadrant];
        const dna = dnaList ? this.random(dnaList) : null;
        // const nuance   = MOOD_NUANCE[moodKey];
        const actMod = activationModifier(data.ativacao ?? 0);

        const scenario = dna ? dna.scenario : "ambiente evocativo";
        const motion = dna ? dna.motion : "pose emocional deliberada";
        const camera = dna ? dna.camera : "plano médio deliberado";
        const nuance = MOOD_NUANCE[moodKey];
        const palette = nuance ? nuance.palette : "gradação cromática natural e equilibrada";
        const atmosphere = nuance ? nuance.atmosphere : "carregado de emoção não dita";
        const symbol = nuance ? nuance.symbol : "detalhe visual significativo";

        // ── Detecção de humor social/grupo ──
        const socialMoods = ["Celebracao", "Euforia", "Energia", "Amor", "Confianca", "Paz"];
        const conexaoSocial = data.emotions?.ConexaoSocial;
        const isGroupMood =
            socialMoods.includes(moodKey) ||
            (typeof conexaoSocial === "number" && conexaoSocial > 0.5) ||
            (data.sentiment && data.sentiment.toLowerCase().includes("conex"));

        const groupScenes = [
            "grupo de amigos em viagem de carro com janelas abertas, vento no cabelo, todos rindo e cantando juntos — ninguém está sozinho, a cena inteira vibra companheirismo",
            "festa descontraída em casa, amigos espalhados pelo sofá e chão, petiscos, risadas soltas, clima de pertencimento total — cada pessoa no quadro importa",
            "show ou festival ao vivo, multidão pulsando junta, braços levantados, a música conectando desconhecidos como se fossem velhos amigos",
            "luau noturno ao redor do fogo na praia, rostos iluminados pela chama, conversas íntimas e risadas ecoando sob as estrelas — grupo unido e acolhedor",
            "grupo caminhando junto pela cidade iluminada à noite, ruas de neon refletindo na chuva fina, braços nos ombros uns dos outros, cumplicidade visual absoluta",
            "amigos brindando em um bar animado ou izakaya, copos se encontrando no ar, expressões de alegria genuína e celebração coletiva",
            "pôr do sol no topo de um telhado ou escadaria, grupo lado a lado em silêncio confortável, aproveitando a companhia mútua em paz expansiva",
            "grupo de amigos deitados na grama de um parque à tarde, olhando as nuvens passarem, conversa solta e risadas ocasionais — conexão tranquila e verdadeira",
            "sala de estar aconchegante, amigos jogando videogame ou cartas, gritos de competição amigável, todos torcendo e rindo juntos — caos caseiro e feliz",
            "grupo dançando junto em uma sala escura com luzes coloridas, sem se importar com passos, apenas se movendo juntos na mesma energia contagiante",
        ];

        let groupRule = "";
        if (isGroupMood) {
            groupRule = `\n\nREGRA DE GRUPO: O humor detectado é SOCIAL e COLETIVO. ${this.random(groupScenes)} A cena DEVE conter múltiplas pessoas interagindo genuinamente — o foco NÃO é um indivíduo, mas a conexão entre eles. Expressões, posturas e olhares devem comunicar pertencimento.`;
        }

        const faceRef = data.faceReferencePath
            ? `Traduzir a identidade facial da pessoa de referência para o estilo do estúdio${isGroupMood ? ', posicionando-a em meio ao grupo como parte integrante da cena coletiva' : ''}. Sem fotorrealismo.`
            : isGroupMood
                ? "Grupo de jovens adultos originais, diversos em aparência mas unidos pelo mesmo momento. Cada pessoa deve ter características físicas distintas (altura, cabelo, tom de pele)."
                : "Personagem jovem adulto(a) original.";

        const copyrightRule = "\n\nREGRA ESTRITA DE COPYRIGHT: TODOS os personagens (protagonista e qualquer pessoa no fundo) DEVEM ser 100% originais e genéricos (OCs). É EXPRESSAMENTE PROIBIDO desenhar personagens que se pareçam com personagens existentes de animes para evitar direitos autorais. O anime de referência serve APENAS para guiar o estilo de coloração, luz e traço, nunca o design dos personagens.";

        const genreMusicRule = (data.topGenre || data.currentSong)
            ? `\n\nREFERÊNCIA MUSICAL (Integrar detalhes/vibecore sutilmente na cena e no estilo do personagem): Subgênero predominante: "${data.topGenre || 'Não especificado'}". Música de inspiração: "${data.currentSong || 'Não especificada'}". Use isso como tempero visual na composição.`
            : "";

        const noFiltersRule = "\n\nREGRA DE CORES E ILUMINAÇÃO: NÃO aplique filtros de cores artificiais, sobreposições (overlays) monocromáticas ou banhos de cor que pintem a imagem inteira de um único tom (como tudo muito azul, verde, vermelho, sépia, etc). EVITE saturação excessiva e cores neon artificiais. A paleta de cores deve ser natural e equilibrada, preservando as cores reais dos personagens e elementos do ambiente sob a luz, sem parecer ter um efeito de correção de cor exagerado. Use contraste com moderação, priorizando a harmonia cromática.";


        const moodContext = `\n\nPALETA DO HUMOR: ${palette}.\nATMOSFERA: ${atmosphere}.\nSÍMBOLO-CHAVE: ${symbol}.\nENERGIA DA CENA: ${actMod}`;

        return `Ilustração 2D anime orginal. Tema: "${data.sentiment}". (Inspirar-se APENAS no estilo de arte de: ${studio.name}, especialmente ${refAnime}).

ESTÚDIO: ${studio.visualLanguage}. ${studio.cinematography}. ${studio.motionStyle}. ${studio.renderingNotes}.

CENA BASE: ${scenario}. POSE BASE: ${motion}. CÂMERA: ${camera}.${groupRule}${genreMusicRule}${noFiltersRule}${moodContext}


PERSONAGEM CENTRAL: ${faceRef}${copyrightRule}

SAÍDA: Retrato 9:16, ilustração 2D anime estilizada. NUNCA fotorrealista. Sem texto/tipografia. Reconhecível como arte do estúdio ${studio.company}.`.trim();
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