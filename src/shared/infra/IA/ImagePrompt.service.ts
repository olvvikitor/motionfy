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

// ── DNA da cena por estúdio e quadrante ──────────────────────────────────────
type SceneDNA = {
    scenarios: string[];
    motions: string[];
    cameraLanguage: string[];
};

const STUDIO_SCENE_DNA: Record<string, Record<Quadrant, SceneDNA>> = {
    kyoani: {
        PositivoAtivo: {
            scenarios: [
                "festival cultural escolar, decorações por toda parte, luz quente de fim de tarde inundando o pátio",
                "apresentação ao vivo do clube de música no palco do ginásio, rostos iluminados pelas luzes do palco",
                "pista de corrida escolar ensolarada, festival esportivo, faixas tremulando ao vento",
            ],
            motions: [
                "girando de alegria, saia do uniforme esvoaçando, olhos brilhantes e rindo",
                "segurando uma amiga que quase tropeçou, ambas explodindo em risadas",
                "correndo a toda velocidade por um corredor de cerejeiras, pétalas voando",
            ],
            cameraLanguage: [
                "plano médio com profundidade de campo rasa, bokeh quente de lanternas ao fundo",
                "ângulo baixo olhando para cima, personagem contra um céu azul cheio de fitas coloridas",
                "plano aberto de toda a cena, personagem pequena mas vibrante no centro",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "canto silencioso de um café junto a uma janela com marcas de chuva, uma xícara de chá fumegando",
                "sala de aula ensolarada depois que todos já foram embora, poeira na luz, caderno aberto",
                "parque de bairro no fim da tarde, banco sob uma árvore gentil",
            ],
            motions: [
                "lendo em silêncio, uma mão apoiada na página aberta, leve sorriso",
                "observando a chuva no vidro, ponta do dedo traçando uma gota escorrendo",
                "sentada de pernas cruzadas sobre uma carteira, fones de ouvido no pescoço, olhos fechados",
            ],
            cameraLanguage: [
                "close-up íntimo na expressão, fundo lindamente desfocado",
                "plano de perfil com a janela como única fonte de luz",
                "plano por cima do ombro olhando para o mundo suavemente iluminado lá fora",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "entrada da escola encharcada de chuva, alunos passando apressados, uma figura parada imóvel",
                "sala de ensaio depois de uma apresentação fracassada, instrumento no suporte, tensão no ar",
                "corredor escuro após uma confrontação, passos ecoando ao longe",
            ],
            motions: [
                "segurando a maçaneta da porta sem abri-la, nós dos dedos brancos",
                "parada rígida sob chuva pesada, sem correr para se abrigar",
                "mãos pressionadas contra os dois ouvidos, cercada por ruído e movimento",
            ],
            cameraLanguage: [
                "close-up cerrado nas mãos, emoção lida pela tensão dos dedos",
                "reflexo em uma poça de chuva, personagem olhando para baixo",
                "enquadramento por cima do ombro, isolando a personagem da multidão",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "terraço vazio da escola ao entardecer, cidade sumindo na distância alaranjada",
                "quarto na hora azul, janela entreaberta, cortina ondulando",
                "plataforma da estação de trem, último trem já partiu, sozinha sob as luzes da estação",
            ],
            motions: [
                "sentada encostada na parede, joelhos para cima, rosto levemente virado",
                "pressionando a mão contra uma janela fria, olhando para algo lá fora",
                "encarando uma fotografia em um cômodo de luz suave, expressão imóvel e dolorida",
            ],
            cameraLanguage: [
                "lento recuo de close para plano aberto, deixando a personagem muito sozinha no quadro",
                "plano estático baixo ao nível do chão, pés da personagem como ponto focal",
                "reflexo na janela com o quarto atrás, dentro e fora ambos suaves",
            ],
        },
        Centro: {
            scenarios: [
                "terraço da escola entre as aulas, vento passando por tudo, cidade visível abaixo",
                "sala de aula vazia, duas cadeiras ainda viradas uma para a outra após uma conversa",
                "entroncamento de corredor, caminhos em três direções, ninguém mais visível",
            ],
            motions: [
                "peso mudando de um pé para o outro, olhando em duas direções",
                "mão erguida para bater, pausando antes do contato",
                "sentada em uma carteira, lápis no ar, sem escrever, sem parar — apenas pairando",
            ],
            cameraLanguage: [
                "composição perfeitamente simétrica, personagem exatamente centralizada",
                "plano aberto onde a personagem está em uma encruzilhada",
                "troca lenta de foco entre dois planos igualmente importantes",
            ],
        },
    },

    ghibli: {
        PositivoAtivo: {
            scenarios: [
                "voando acima das nuvens nas costas de uma criatura espiritual, sol rompendo por baixo",
                "cidade-mercado de fantasia movimentada, faixas tremulando, criaturas e pessoas por toda parte",
                "topo de penhasco com vista para um vale mágico, vento forte e quente",
            ],
            motions: [
                "braços abertos em voo livre, cabelo em todas as direções, rosto de pura alegria",
                "correndo pela multidão de um festival de espíritos, cor e luz em cada direção",
                "saltando de um telhado para o céu limpo, companheiro espiritual ao lado",
            ],
            cameraLanguage: [
                "grande plano aberto de baixo, personagem contra um vasto céu azul",
                "plano de acompanhamento ao lado de uma criatura em pleno voo, horizonte inclinando",
                "grua lenta e suave subindo para revelar toda a paisagem mágica abaixo",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "campo de flores na hora dourada, uma pequena cabana visível no vale abaixo",
                "cabana à beira-mar no verão, barcos de pesca no porto, vento suave passando pela grama",
                "floresta ancestral ao amanhecer, luz filtrando por árvores enormes, espíritos flutuando",
            ],
            motions: [
                "deitada na grama alta olhando as nuvens, uma mão trilhando lentamente pelo prado",
                "sentada em um muro de pedra observando o mar, contente e sem lugar para ir",
                "cuidando de algo pequeno com grande carinho — uma semente, uma flor, um espírito",
            ],
            cameraLanguage: [
                "enorme plano panorâmico de estabelecimento, personagem minúscula em repouso",
                "deslocamento lento por um ambiente lindo, personagem em companhia tranquila com ele",
                "ângulo baixo gentil a partir do chão, grama em primeiro plano, personagem e céu acima",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "tempestade caindo sobre uma cidade costeira, mar agitado, venezianas batendo",
                "fúria de um espírito ancestral tornada visível — floresta tremendo, escuridão se espalhando",
                "fuga urgente por um céu marcado pela guerra, fogueiras abaixo lançando luz para cima",
            ],
            motions: [
                "se mantendo firme contra um vento poderoso, cabelo e casaco violentos em movimento",
                "correndo por uma ponte que se desintegra sobre um rio espiritual agitado",
                "um braço erguido para proteção, o outro esticado para algo fora de alcance",
            ],
            cameraLanguage: [
                "plano aberto mostrando toda a escala do ambiente hostil ao redor de uma figura pequena",
                "plano de acompanhamento rente ao chão de uma corrida desesperada, mundo se borrando",
                "close-up apertado de um rosto se resolvendo em coragem no meio da tempestade",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "santuário abandonado nas profundezas de uma floresta de inverno, neve assentando sobre torii de pedra",
                "pequeno barco ancorado em uma baía coberta de neblina, nenhum outro barco à vista",
                "ruínas cobertas de vegetação de um castelo mecânico, uma janela ainda acesa",
            ],
            motions: [
                "sentada em degraus de pedra antigos olhando pétalas caindo, sem tentar pegá-las",
                "ajoelhada ao lado de uma pequena lápide na floresta, mão repousando gentilmente sobre ela",
                "caminhando muito lentamente pela neblina, o mundo reduzido a três metros em todas as direções",
            ],
            cameraLanguage: [
                "lento recuo amplo revelando a escala do vazio ao redor da personagem",
                "longo plano estático — natureza se movendo sutilmente, personagem perfeitamente imóvel",
                "ângulo alto, personagem pequena em uma vasta paisagem em ruínas",
            ],
        },
        Centro: {
            scenarios: [
                "balsa entre dois mundos, ambas as margens visíveis, a água perfeitamente calma",
                "encruzilhada em uma floresta de espíritos, caminhos em quatro direções, nenhum mais evidente",
                "limiar de uma porta mágica, um mundo brilhante, um desconhecido",
            ],
            motions: [
                "de pé na grade da balsa, sem olhar para nenhuma margem, apenas a água",
                "uma mão no batente da porta, peso sem se comprometer a entrar ou sair",
                "agachada examinando algo pequeno demais para nomear, expressão indecifrável",
            ],
            cameraLanguage: [
                "simetria perfeita, ambos os mundos espelhados em cada lado da personagem",
                "dolly lateral lento revelando um mundo substituindo o outro",
                "plano enquadrado por uma porta ou arco, mundo dividido pela moldura",
            ],
        },
    },

    ufotable: {
        PositivoAtivo: {
            scenarios: [
                "ativação de noble phantasm, realidade fraturando nas bordas com luz dourada",
                "terraço acima de uma cidade à noite após uma vitória decisiva, resíduo de mana brilhando",
                "salão do trono ancestral banhado pela luz de um bounded field triunfante",
            ],
            motions: [
                "arma erguida ao alto, círculos mágicos desabrochando sob os pés",
                "aterrissando de grande altura, cratera se formando, energia dissipando para fora",
                "olhos abertos após uma explosão de poder, brilho diminuindo, respiração se acalmando",
            ],
            cameraLanguage: [
                "arco amplo em 3D ao redor de uma figura triunfante, céu imenso",
                "ângulo heroico baixo com raios de luz volumétrica emanando por trás",
                "tracking pull-back de alta velocidade, de extremamente perto a uma escala vasta",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "santuário japonês sob luar após a batalha, torii projetando sombras perfeitas",
                "servo e mestre em um jardim tranquilo, o mundo mágico momentaneamente em paz",
                "grande biblioteca de um castelo ao entardecer, última luz pelas janelas altas sobre livros antigos",
            ],
            motions: [
                "embainhando uma arma lentamente, olhos fechando em alívio silencioso",
                "duas figuras sentadas juntas, em silêncio, resíduo mágico desaparecendo do ar",
                "uma mão erguida para tocar um artefato mágico flutuante, expressão pacífica",
            ],
            cameraLanguage: [
                "push-in lento em uma expressão composta sob luz ambiente mágica",
                "two-shot cerrado com profundidade de campo extraordinária e brilho de partículas",
                "plano de estabelecimento em ângulo alto de uma paisagem mágica serena na hora dourada",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "erupção de linha ley rachando um distrito da cidade, luz e sombra em batalha violenta",
                "bounded field colapsando para dentro, realidade descascando nas bordas",
                "igreja abandonada, neblina e chama escura, duas forças prestes a colidir",
            ],
            motions: [
                "braço estendido invocando um noble phantasm, ar distorcendo ao redor",
                "deslizando para uma postura defensiva, selo de comando brilhando nas costas da mão",
                "costas contra um pilar, respiração controlada, calculando antes de golpear",
            ],
            cameraLanguage: [
                "câmera girando em arco ao redor da personagem enquanto energia explode para fora",
                "ângulo holandês com luz volumétrica sombria, personagem em relevo nítido",
                "push-in acelerado no ponto de tensão máxima, profundidade de campo colapsando",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "interior de igreja em ruínas após uma batalha, vitrais quebrados, luar sobre escombros",
                "câmara do graal vazia, sem vencedor, a luz da câmara morrendo",
                "servo começando a desaparecer, contorno suavizando, olhos ainda abertos",
            ],
            motions: [
                "ajoelhado com uma mão no chão, forças quase esgotadas",
                "olhando as mãos desaparecendo conforme a forma espiritual se dissolve em luz",
                "de pé na borda de uma plataforma em ruínas, olhando para baixo, sem cair",
            ],
            cameraLanguage: [
                "lento recuo de um close-up íntimo para um vasto espaço vazio",
                "vista aérea olhando direto para baixo sobre uma figura solitária nas ruínas",
                "perfil lateral em um feixe de luar, maior parte do quadro em sombra profunda",
            ],
        },
        Centro: {
            scenarios: [
                "floresta dos Einzbern no crepúsculo, nem dia nem noite, magia suspensa no ar",
                "uma ponte sobre um rio escuro, dois servos parados no meio da travessia",
                "o momento antes de uma escolha de selo de comando, o selo pela metade iluminado",
            ],
            motions: [
                "mãos entrelaçadas, olhos fechados, ainda sem decisão, o momento suspenso",
                "duas figuras em extremidades opostas de uma ponte, nenhuma se movendo primeiro",
                "um único passo interrompido no ar, tudo ao redor pausado",
            ],
            cameraLanguage: [
                "diopter dividido — perto e longe igualmente nítidos, nenhum dominante",
                "órbita lenta ao redor de uma figura perfeitamente imóvel em um espaço liminar",
                "troca de foco ciclando entre dois planos iguais, sem encontrar resposta",
            ],
        },
    },

    mappa: {
        PositivoAtivo: {
            scenarios: [
                "terraço de Tóquio à noite, reflexos de neon encharcando o concreto molhado abaixo",
                "ringue de boxe subterrâneo, luz vermelha do corner, multidão de pé",
                "cruzamento de Shibuya esvaziado, personagem no centro, cidade explodindo ao redor",
            ],
            motions: [
                "punho erguido após uma luta, suor e euforia, multidão atrás",
                "parkour urbano — se lançando de um corrimão, cidade caindo abaixo",
                "arrombando uma porta para o ar aberto, contraluz da cidade abaixo",
            ],
            cameraLanguage: [
                "crash zoom na expressão triunfante, bokeh de luzes da cidade",
                "ângulo holandês baixo mostrando escala e ímpeto, mundo inclinado com energia",
                "whip pan acompanhando o movimento a toda velocidade por um cenário urbano",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "canto de booth em izakaya, luz âmbar quente, duas pessoas após um dia difícil",
                "konbini às 2 da manhã, único cliente, calor fluorescente contra a noite azul lá fora",
                "terraço de apartamento ao pôr do sol, roupas no varal, cidade ficando silenciosa abaixo",
            ],
            motions: [
                "recostado com uma latinha, olhando a cidade de uma grade, à vontade",
                "rindo de algo pequeno, cotovelos apoiados em uma mesa baixa",
                "duas pessoas caminhando lentamente para casa, mãos quase se tocando",
            ],
            cameraLanguage: [
                "plano médio íntimo com fundo urbano texturizado suavemente iluminado",
                "perfil lateral com luz quente suave de dentro cortando o exterior azul",
                "plano aberto da cena humana completa, cidade como pano de fundo e não ameaça",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "expansão de domínio colapsando Shibuya, energia amaldiçoada rasgando o ar",
                "quarteirão da cidade em ruínas sob um céu vermelho-sangue, apenas uma figura de pé",
                "luta subterrânea em gaiola, fúria e desespero, tela de metal captando a luz",
            ],
            motions: [
                "golpe Black Flash — tempo fractalizado, punho no impacto, mundo ficando branco",
                "gritando com um domínio se expandindo do corpo, braços abertos",
                "segurando um fragmento de parede caindo com as mãos nuas, joelhos cedendo sob o peso",
            ],
            cameraLanguage: [
                "freeze-frame de impacto: parada total, linhas de energia, close-up extremo",
                "ângulo holandês extremo com energia handheld frenética, caos mal contido",
                "corte para preto no meio do movimento, mantido por um instante, depois corte de volta",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "academia vazia às 4 da manhã, uma única luz no teto, saco de pancadas ainda balançando",
                "beco sob um viaduto na chuva, cerca de arame, uma poça de luz laranja refletida",
                "apartamento com todas as luzes apagadas exceto o brilho do monitor, marmita fria na mesa",
            ],
            motions: [
                "sentado em um banco de vestiário, cabeça baixa, antebraços nos joelhos",
                "de pé na chuva sob um guarda-chuva falhando, sem se mover para se abrigar",
                "encostado em uma parede de concreto frio, escorregando lentamente até sentar no chão",
            ],
            cameraLanguage: [
                "close-up apertado nas mãos penduradas entre os joelhos, rosto mal visível",
                "plano baixo no nível do chão, personagem dobrado sobre si mesmo em um canto",
                "plano médio estático e achatado, personagem dentro de uma caixa de luz fluorescente agressiva",
            ],
        },
        Centro: {
            scenarios: [
                "plataforma de trem à meia-noite, personagem no meio de uma decisão, trem visível ao longe",
                "cruzamento de Shibuya às 3 da manhã, todos os sinais pausados, sozinho no centro",
                "apartamento meio empacotado com caixas, algumas guardadas, outras ainda abertas",
            ],
            motions: [
                "celular na mão, mensagem não enviada na tela, polegar pairando",
                "um pé no trem, outro ainda na plataforma, portas prestes a fechar",
                "olhando para duas jaquetas diferentes dispostas, nenhuma pegada",
            ],
            cameraLanguage: [
                "plano simétrico centralizado, personagem como eixo entre dois mundos",
                "push-in lento que não se compromete com nenhum lado do quadro",
                "handheld com flutuação sutil, sem resolução, buscando",
            ],
        },
    },

    shaft: {
        PositivoAtivo: {
            scenarios: [
                "arquitetura impossível se estilhaçando em fragmentos geométricos de cor brilhante",
                "espaço caleidoscópico abstrato feito de painéis de texto inclinados e blocos de cor em celebração",
                "paisagem urbana surreal onde a gravidade abandonou sua direção habitual, personagem em seu ápice",
            ],
            motions: [
                "cabeça inclinada em um ângulo impossível, abrindo um sorriso que quebra a composição",
                "braços esticados, silhueta contra um vazio de cor pura saturada",
                "girando em um ambiente matematicamente impossível, cada rotação revelando um novo mundo",
            ],
            cameraLanguage: [
                "zoom em espiral centrado na personagem, geometria se desdobrando ao redor",
                "ângulo holandês extremo invertendo para o extremo oposto no meio do plano",
                "cortes rápidos entre quadros geométricos estáticos, cada um com um ângulo diferente do mesmo momento",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "estantes de livros se estendendo ao infinito em luz âmbar quente, escala e quietude impossíveis",
                "um cômodo branco com uma única janela impossivelmente bela e nada mais",
                "um jardim simbólico sem física — flores no ar, água fluindo para cima",
            ],
            motions: [
                "sentada em espaço branco, perna cruzada, lendo algo que só ela pode ver",
                "uma mão alcançando uma fonte de luz impossível, vindo apenas do lado esquerdo do quadro",
                "completamente imóvel, de costas, o ambiente arranjado em calma perfeita ao redor",
            ],
            cameraLanguage: [
                "plano longuíssimo — personagem um único glifo em um espaço quente infinito",
                "plano frontal achatado com toda a profundidade removida, puramente gráfico",
                "deslocamento lateral lento, o ambiente um painel contínuo de calor abstrato",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "corredor surreal inclinando em direção a um ponto de fuga que não leva a lugar nenhum",
                "formas abstratas colapsando para dentro como um mundo se dobrando sobre si mesmo",
                "confronto em um campo de espaço negativo — apenas figuras e sombra, sem ambiente",
            ],
            motions: [
                "a icônica inclinação de cabeça — mas executada a 90 graus, olho travado direto no espectador",
                "sombra se descascando do corpo e se movendo independentemente em outra direção",
                "duas silhuetas em extremidades opostas de um quadro inclinado, ambas rígidas, nenhuma cedendo",
            ],
            cameraLanguage: [
                "ângulo holandês extremo a 45°, nada horizontal no quadro",
                "cortes secos rápidos entre ângulos estáticos desconfortáveis, ritmo construindo pressão",
                "smash para cor pura, mantido, depois corte seco para close-up apertado",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "corredor infinito monocromático com um único detalhe — uma janela acesa, uma porta aberta",
                "um vazio de cinza plano com uma cadeira impossível e uma luminária impossível",
                "um cômodo feito de livros empilhados, todos fechados, todos cinza, se estendendo para sempre",
            ],
            motions: [
                "sentada absolutamente imóvel, enfrentando a câmera, expressão desprovida de todo afeto",
                "uma única lágrima desenhada como uma linha geométrica perfeita em um rosto de traço plano",
                "de pé em um vazio, braços ao lado do corpo, o ambiente fazendo todo o trabalho emocional",
            ],
            cameraLanguage: [
                "plano frontal perfeitamente travado, zero movimento de câmera, composição formal",
                "close-up extremo no olho, o vazio refletido nele",
                "push-in mecânico muito lento por longa duração, sem ponto de chegada",
            ],
        },
        Centro: {
            scenarios: [
                "uma escadaria impossível subindo e descendo sem diferença entre os dois",
                "um cômodo espelhado onde o reflexo mostra um momento diferente do que está acontecendo",
                "um corredor com portas idênticas em ambos os lados, todas iguais, sem como distinguir",
            ],
            motions: [
                "mãos cruzadas no colo, de frente para a câmera, perfeitamente imóvel, nem sim nem não",
                "reflexo fazendo algo levemente diferente da figura original",
                "dedo apontado para a câmera, pausado, nunca chegando",
            ],
            cameraLanguage: [
                "quadro dividido — metade esquerda e metade direita fazendo coisas completamente diferentes simultaneamente",
                "rotação lenta de todo o quadro, personagem permanecendo vertical enquanto o mundo gira",
                "troca de foco que nunca se compromete, ciclando entre dois planos",
            ],
        },
    },

    trigger: {
        PositivoAtivo: {
            scenarios: [
                "cabine de mecha gigante em sincronização máxima, galáxia espiral pela janela de visualização",
                "cidade neon distópica a 200 km/h, prédios se borrando em cor",
                "chão da arena após uma vitória decisiva, plateia explodindo, luzes no vencedor",
            ],
            motions: [
                "apontando dramaticamente para o céu, capa explodindo para fora, proporções impossíveis",
                "sequência de transformação — metade humano, metade algo cósmico",
                "gritando um grito de guerra no volume máximo, mundo se curvando ao redor do som",
            ],
            cameraLanguage: [
                "zoom em espiral para close-up extremo, linhas de energia em todas as direções",
                "ângulo baixo impossível, personagem contra uma galáxia infinitamente espiral",
                "smash cut para quadro de impacto: parada total, white-out, linhas de energia, depois explosão para plano aberto",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "praia em um pôr do sol impossivelmente saturado — céu fazendo coisas que a física não permite",
                "topo de colina com vista para uma cidade neon brilhante, harmonia de cores impossível acima e abaixo",
                "o interior de um pôster promocional da Trigger ganhando vida — estilizado e icônico",
            ],
            motions: [
                "recostado em uma encosta, braços atrás da cabeça, completamente desguarnecido",
                "olhos semicerrados para o horizonte, expressão de calma presunçosa de quem já venceu",
                "pés pendurados sobre uma queda enorme, em paz perfeita com isso",
            ],
            cameraLanguage: [
                "plano aberto estilizado com a personagem como elemento gráfico em um mundo gráfico",
                "grua panorâmica subindo do chão para revelar toda a paisagem impossível",
                "silhueta achatada contra um céu de gradiente saturado, forte energia de design gráfico",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "cidade sob ataque de energia espiral — prédios cisalhando, céu rachando",
                "resistência final em uma plataforma destruída, o mundo caindo ao redor de uma única figura",
                "interior de uma cabine de mecha colapsando, piloto recusando parar",
            ],
            motions: [
                "carga corporal total para frente, quadros de smear exagerados, linhas de velocidade em toda parte",
                "rotação no ar antes de um ataque devastador, corpo tencionado ao máximo",
                "punho no ponto de impacto, onda de choque irradiando para fora, mundo rachando no ponto",
            ],
            cameraLanguage: [
                "ângulo holandês rotativo combinado com crash zoom — puro caos cinético",
                "freeze-frame de impacto: flash branco, linhas de energia, mantido por exatamente uma respiração",
                "ângulo extremo baixo a partir do chão, ataque vindo de cima em escala total",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "rescaldo de uma batalha mecha — uma figura ajoelhada em um campo de destroços, céu clareando",
                "personagem solitária no centro de uma arena destruída, fumaça subindo, plateia se foi",
                "costa rochosa ao amanhecer depois de algo enorme ter terminado na noite anterior",
            ],
            motions: [
                "sentado de pernas cruzadas nos escombros, mãos no colo, olhos fechados, em paz agora",
                "uma mão pressionada contra o peito, cabeça inclinada para trás, sem fôlego mas vivo",
                "olhando para uma arma quebrada segurada com ambas as mãos, expressão suave de aceitação",
            ],
            cameraLanguage: [
                "grua aberta lenta revelando toda a escala do rescaldo ao redor de uma pequena figura imóvel",
                "close-up cerrado em uma expressão de paz exausta, destroços suaves ao fundo",
                "plano traseiro, personagem de frente para o horizonte, mundo atrás encerrado",
            ],
        },
        Centro: {
            scenarios: [
                "encruzilhada entre dois mundos impossíveis — um espiral, um linear, ambos totais",
                "o exato centro geométrico de um universo Trigger, equidistante de todas as forças",
                "um ponto de quietude dentro de uma espiral em andamento que ainda não resolveu sua direção",
            ],
            motions: [
                "de pé com braços abertos, peso em um pé, ainda sem se comprometer com o próximo movimento",
                "olhos semicerrados olhando para dois futuros igualmente impossíveis com calma igual",
                "uma mão fechada, uma mão aberta — nenhuma ação escolhida",
            ],
            cameraLanguage: [
                "plano rotativo que nunca para, mundo ciclando infinitamente ao redor da personagem",
                "divisão simétrica mostrando duas forças iguais e opostas perfeitamente equilibradas",
                "recuo de extremamente perto a cosmicamente amplo, pausando no centro exato",
            ],
        },
    },
};

// ── Nuance emocional por mood (paleta, atmosfera, símbolo) ────────────────────
type MoodNuance = { palettes: string[]; atmosphere: string[]; symbols: string[] };

const MOOD_NUANCE: Record<string, MoodNuance> = {
    Euforia:    { palettes: ["explosão de amarelo elétrico e âmbar sobre sombra profunda", "ouro neon com bloom luminoso e especular branco quente"], atmosphere: ["tempo suspenso em seu momento mais rápido e mais vivo", "o mundo incandescente por exatamente este instante"], symbols: ["fogos de artifício em plena explosão preenchendo o céu", "vidro estilhaçado congelado na luz"] },
    Celebracao: { palettes: ["coral vívido e ouro quente com luz de celebração saturada", "rosa festivo e tons âmbar com explosões de partículas cintilantes"], atmosphere: ["alegria compartilhada que se multiplica quando sentida junto — a eletricidade de pertencer a uma multidão que está toda sentindo a mesma coisa", "o momento ápice de euforia coletiva, corpos próximos, vozes altas, tempo suspenso em seu ponto mais vivo"], symbols: ["multidão de amigos em silhueta no meio de um salto contra uma explosão de fogos de artifício, linhas de energia radiando — sem comida, sem mesas, apenas pessoas e luz", "multidão de show em festival gritando juntos, protagonista erguido acima deles, confete e trilhas de luz em todas as direções"] },
    Confianca:  { palettes: ["azul aço frio e lima sobre quase-preto", "monocromático com um acento neon afiado perfurando"], atmosphere: ["autoridade silenciosa que não precisa de anúncio", "certeza calma antes de algo inevitável"], symbols: ["cidade refletida em lentes", "padrões geométricos de sombra em alinhamento perfeito"] },
    Energia:    { palettes: ["laranja industrial e ciano bruto sobre asfalto preto", "neon agressivo sobre textura escura e áspera"], atmosphere: ["a física no limite humano", "cada superfície vibrando com potencial cinético"], symbols: ["linhas de rachadura a partir de um ponto de impacto", "suor congelado no ar sob luz agressiva"] },
    Amor:       { palettes: ["rosa corado e marfim em difusão suave de manhã", "terracota quente e malva com suave flare de lente"], atmosphere: ["tempo no ritmo de um batimento cardíaco", "ternura que não precisa de palavras"], symbols: ["flores prensadas e uma vela suave", "duas xícaras de café fumegando lado a lado"] },
    Paz:        { palettes: ["verde-espuma e azul celeste pálido sobre luz creme da manhã", "lavanda empoeirada e branco-nuvem na hora dourada"], atmosphere: ["o silêncio antes de o mundo acordar", "quietude escolhida e completa"], symbols: ["uma única pena flutuando no ar parado", "luz através de folhas fazendo padrões ondulantes"] },
    Reflexao:   { palettes: ["índigo profundo e lavanda com acentos de brilho estelar", "azul-marinho de meia-noite com bloom violeta de luzes distantes da cidade"], atmosphere: ["uma pergunta sem resposta ainda", "memória e presente se misturando nas bordas"], symbols: ["vela refletida em vidro com marcas de chuva", "estrelas espelhadas em uma poça parada"] },
    Tensao:     { palettes: ["verde-amarelo doentio fluorescente sobre sombra fria", "quase-monocromático dessaturado com uma única fonte de luz vermelha"], atmosphere: ["o pavor de algo não dito e inevitável", "cada pequeno som carregando duplo significado"], symbols: ["tela de celular piscando virada para baixo", "espelho rachado em um banheiro escuro"] },
    Revolta:    { palettes: ["vermelho-sangue e obsidiana com rim light agressiva", "amarelo-enxofre e preto-carvão com brilho de brasa"], atmosphere: ["raiva contida por tempo demais e finalmente rompida", "destruição como a única linguagem restante"], symbols: ["concreto estilhaçado com vergalhão exposto", "brasas subindo de um fogo morrendo"] },
    Frustracao: { palettes: ["âmbar enlameado e carvão com fonte agressiva de cima", "laranja-dourado apagado com subluz azul fria"], atmosphere: ["atrito entre o que deveria ser e o que é", "energia presa sem lugar para ir"], symbols: ["uma placa de beco sem saída na chuva", "um relógio cujos ponteiros se recusam a mover"] },
    Melancolia: { palettes: ["azul-aço suave e lavanda empoeirada em luz difundida pela neblina", "calor sépia sangrando em azul de fim de tarde frio"], atmosphere: ["nostalgia desgastada suavemente pelo tempo — agridoce, não aguda", "a beleza das coisas passando, ainda não idas"], symbols: ["um guarda-chuva esquecido em um banco na chuva", "um nome entalhado em uma árvore velha crescendo fora de forma"] },
    Tristeza:   { palettes: ["ardósia profunda e estanho sobre quase-preto", "lavagem azul-cinza de baixo contraste com um único ponto quente fraco de luz"], atmosphere: ["luto que se acomodou e não vai embora", "a ausência de algo que antes preenchia o quadro"], symbols: ["uma flor murcha em um copo d'água", "uma cadeira vazia em uma mesa posta"] },
    Vazio:      { palettes: ["cinza-concreto e branco desbotado — sem calor em lugar nenhum", "ciano dessaturado e achatado com quase-preto e zero contraste"], atmosphere: ["a estática entre estações, sinal perdido", "não é tristeza — apenas a ausência completa de tudo"], symbols: ["uma tela em branco refletindo um rosto", "um cômodo com tudo no lugar e ninguém nele"] },
    Ambivalente:{ palettes: ["bicolor dividido: âmbar quente de um lado, azul frio do outro", "hora dourada e nublado no mesmo quadro, perfeitamente divididos"], atmosphere: ["o momento suspenso entre dois futuros completamente diferentes", "a estranha beleza de ainda não saber"], symbols: ["uma moeda no meio do giro com ambas as faces visíveis", "uma porta entreaberta com luz diferente de cada lado"] },
};

// ── Modificador de ativação ───────────────────────────────────────────────────
function activationModifier(ativacao: number): string {
    if (ativacao >  0.6) return "ENERGIA CINÉTICA ALTA: cena pulsando com movimento. Use motion blur nas periferias, ângulos dinâmicos, movimento ambiental violento. O tempo parece comprimido e rápido.";
    if (ativacao >  0.2) return "ENERGIA MODERADA: impulso natural para frente. Ambiente em movimento (luzes balançando, carros passando, vento). Personagem engajada e presente.";
    if (ativacao > -0.2) return "ENERGIA EQUILIBRADA: a cena respira naturalmente. Apenas pequenos movimentos — folha caindo, vapor subindo, tecido ao vento. Personagem composta e atenta.";
    if (ativacao > -0.6) return "ENERGIA BAIXA E SUAVE: lento e contemplativo. Longos momentos de quietude. Movimento mínimo. Personagem absorvida para dentro.";
    return                      "QUASE ESTÁTICO: praticamente imóvel. Poeira em um feixe de luz. Uma respiração contida. A personagem mal se move — a quietude é o tema.";
}

// ── Estilos dos estúdios ──────────────────────────────────────────────────────
const STUDIO_STYLES: StudioStyle[] = [
    {
        id: "kyoani", name: "Inspirado em Kyoto Animation (KyoAni)", company: "Kyoto Animation", logoKey: "kyoani",
        referenceAnimes: ["Violet Evergarden", "K-On!", "Hyouka", "A Silent Voice", "Clannad After Story"],
        visualLanguage: "iluminação difusa e suave, paleta pastel, olhos brilhantes e expressivos, micro-expressões detalhadas, renderização limpa e polida, realismo emocional slice-of-life",
        cinematography: "enquadramento natural e estável, close-ups íntimos, foco na atuação da personagem acima do espetáculo",
        motionStyle: "extremamente fluida, gestos sutis — movimento dos olhos, respiração, balanço do cabelo — alta consistência entre quadros",
        renderingNotes: "anatomia e detalhe de tecido meticulosos, iluminação realista, ambientes cotidianos ricos com profundidade e suavidade",
    },
    {
        id: "ghibli", name: "Inspirado em Studio Ghibli", company: "Studio Ghibli", logoKey: "ghibli",
        referenceAnimes: ["Spirited Away", "Howl's Moving Castle", "Princess Mononoke", "The Wind Rises", "My Neighbor Totoro"],
        visualLanguage: "fundos pintados à mão em aquarela, texturas orgânicas, harmonia de cores natural, designs de personagem profundamente expressivos mas simples, nostálgico e onírico",
        cinematography: "planos cênicos amplos, narrativa ambiental, ritmo lento e contemplativo, atmosfera e imersão no mundo acima de tudo",
        motionStyle: "movimento com peso e natural, física crível mesmo na fantasia, ritmo calmo e deliberado",
        renderingNotes: "pinceladas visíveis, sensação de cel tradicional, forte conexão entre personagens e o mundo natural vivo",
    },
    {
        id: "ufotable", name: "Inspirado em Ufotable", company: "ufotable", logoKey: "ufotable",
        referenceAnimes: ["Fate/stay night UBW", "Demon Slayer", "Kara no Kyoukai", "Tales of Zestiria the X"],
        visualLanguage: "iluminação cinematográfica, alto contraste, destaques brilhantes, efeitos pesados de partículas (brasas fumaça faíscas), composição digital com profundidade de campo",
        cinematography: "movimento de câmera dinâmico, ângulos amplos assistidos por 3D, planos de acompanhamento cinematográficos comparáveis a filmes live-action",
        motionStyle: "suave mas impactante, antecipação e liberação dramáticas, precisão de timing em camadas de VFX",
        renderingNotes: "composição polida, iluminação atmosférica volumétrica, forte estratificação de profundidade entre personagem e efeito",
    },
    {
        id: "mappa", name: "Inspirado em Studio MAPPA", company: "MAPPA", logoKey: "mappa",
        referenceAnimes: ["Jujutsu Kaisen", "Chainsaw Man", "Attack on Titan Final Season", "Vinland Saga S2"],
        visualLanguage: "contraste cinematográfico, textura urbana áspera, linework expressivo, emoção facial intensa, anatomia ancorada com impacto dramático",
        cinematography: "câmera dinâmica mas controlada, silhuetas fortes, staging focado em ação com profundidade atmosférica sombria",
        motionStyle: "movimento pesado e impactante com poses-chave marcadas, ritmo de alta tensão e coreografia legível",
        renderingNotes: "design rico de sombras, fundos texturizados, separação dramática de cores, realismo ancorado sem fotorrealismo",
    },
    {
        id: "shaft", name: "Inspirado em Studio Shaft", company: "Shaft", logoKey: "shaft",
        referenceAnimes: ["Bakemonogatari", "Puella Magi Madoka Magica", "March Comes in Like a Lion", "Sayonara Zetsubou Sensei"],
        visualLanguage: "composição avant-garde, blocos de cor ousados, fundos abstratos ou simbólicos, ambientes minimalistas com forte identidade gráfica",
        cinematography: "ângulos extremos, inclinações de cabeça, cortes secos rápidos, enquadramento incomum com pesado espaço negativo",
        motionStyle: "animação limitada usada estilisticamente — foco em composição e ritmo gráfico acima de fluidez de movimento",
        renderingNotes: "encenação surreal, imagética simbólica, narrativa visual experimental — a forma serve a psicologia, não o naturalismo",
    },
    {
        id: "trigger", name: "Inspirado em Studio Trigger", company: "Studio Trigger", logoKey: "trigger",
        referenceAnimes: ["Kill la Kill", "Promare", "Cyberpunk Edgerunners", "Gurren Lagann", "Little Witch Academia"],
        visualLanguage: "linework ousado, cor saturada ao máximo, proporções exageradas, design expressivo e cartunesco levado ao extremo",
        cinematography: "cortes rápidos, zooms extremos, enquadramento dinâmico impossível, narrativa visual de alta energia no volume máximo",
        motionStyle: "hipercinética, smear frames, exagerado até o ponto de deformação — caos intencional que é sempre legível",
        renderingNotes: "silhuetas fortes, formas de contraste máximo, deformação expressiva sempre preferida sobre realismo anatômico",
    },
];

@Injectable()
export class ImagePromptService {

    build(data: HybridPromptInput) {
        const studio      = this.getStudioStyle(data.studioId);
        const refAnime    = this.random(studio.referenceAnimes);
        const moodKey     = this.normalizeMoodKey(data.sentiment);
        const quadrant    = MOOD_TO_QUADRANT[moodKey] ?? "Centro";
        const dna         = STUDIO_SCENE_DNA[studio.id]?.[quadrant];
        const nuance      = MOOD_NUANCE[moodKey];
        const actMod      = activationModifier(data.ativacao ?? 0);

        const scenario    = dna     ? this.random(dna.scenarios)      : "um ambiente evocativo";
        const motion      = dna     ? this.random(dna.motions)        : "uma pose emocional deliberada";
        const camera      = dna     ? this.random(dna.cameraLanguage) : "plano médio deliberado";
        const palette     = nuance  ? this.random(nuance.palettes)    : "gradação de cor cinematográfica rica";
        const atmosphere  = nuance  ? this.random(nuance.atmosphere)  : "carregado de emoção não dita";
        const symbol      = nuance  ? this.random(nuance.symbols)     : "um detalhe visual significativo";

        const moodSpecificRules = moodKey === "Celebracao" ? `
━━━━━━━━━━
REGRAS ESPECÍFICAS DO MOOD — CELEBRAÇÃO (CELEBRAÇÃO SOCIAL)
━━━━━━━━━━
Este mood é sobre ALEGRIA SOCIAL COLETIVA como vista em produções icônicas de anime.
OBRIGATÓRIO: A cena deve retratar uma multidão, grupo de amigos, ou grande reunião social em um momento ápice de celebração — exatamente como uma cena climática de um anime famoso.
Inspiração: multidão de arena de show explodindo durante uma performance final (K-On!, Your Lie in April), multidão de festival escolar enlouquecendo, momento de vitória em grupo com personagens erguidos acima de uma multidão eufórica (Haikyuu!!), cena de fogos de festival com figuras em silhueta juntas (qualquer cena de matsuri Ghibli), finale de palco de idol com light sticks e milhares de fãs (Love Live!, Oshi no Ko).
ESTRITAMENTE PROIBIDO: mesas de jantar, comida em mesas, cenários de banquete, cenas de restaurante, montagens de piquenique, ou qualquer arranjo de itens de comida perto de personagens. Sem refeições. Sem comer. Sem arrumações de mesa de qualquer tipo.
A fonte de energia são PESSOAS e EMOÇÃO COMPARTILHADA, não comida. Luzes, confete, fogos de artifício, palcos de música, movimento de multidão, light sticks e energia de estádio são os únicos elementos ambientais aceitáveis.
` : "";

        return `
Crie uma ilustração 2D estilizada de anime de tirar o fôlego no estilo de ${studio.name}, capturando o tema emocional "${data.sentiment}".

FIDELIDADE VISUAL INEGOCIÁVEL:
Mantenha 100% de fidelidade ao DNA estético do estúdio em todos os momentos. Cada escolha — ambiente, iluminação, linework, cor, movimento — deve parecer que pertence autenticamente a uma produção da ${studio.company}. Anime de referência: ${refAnime}.

━━━━━━━━━━
DNA DO ESTÚDIO
━━━━━━━━━━
Linguagem visual: ${studio.visualLanguage}
Cinematografia: ${studio.cinematography}
Estilo de movimento: ${studio.motionStyle}
Renderização: ${studio.renderingNotes}

━━━━━━━━━━
CENA — PELAS LENTES DA ${studio.company.toUpperCase()}
━━━━━━━━━━
Ambiente (renderizar no estilo autêntico da ${studio.company}):
${scenario}

Postura / movimento da personagem (ancorado no vocabulário de animação da ${studio.company}):
${motion}

Linguagem de câmera (estritamente cinematografia da ${studio.company}):
${camera}

━━━━━━━━━━
DIREÇÃO EMOCIONAL — "${data.sentiment.toUpperCase()}"
━━━━━━━━━━
Paleta de cores: ${palette}
Qualidade atmosférica: ${atmosphere}
Elemento visual simbólico (integrar organicamente): ${symbol}
Nível de energia: ${actMod}
${moodSpecificRules}
━━━━━━━━━━
PERSONAGEM
━━━━━━━━━━
Referência facial: ${data.faceReferencePath ?? "não fornecida"}
- Se uma referência facial for fornecida, traduza a identidade para a linguagem de design de personagem da ${studio.company}. Não retenha fotorrealismo.
- Personagem jovem adulto(a) único(a).

━━━━━━━━━━
SAÍDA
━━━━━━━━━━
- Proporção: 9:16 (Retrato)
- Formato: Ilustração 2D Estilizada de Anime. NUNCA fotorrealista.
- O resultado deve ser instantaneamente reconhecível como uma produção da ${studio.company}.
- NÃO inclua texto legível ou tipografia flutuante (texto ambiental incidental, como placas distantes, é aceitável).
`.trim();
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