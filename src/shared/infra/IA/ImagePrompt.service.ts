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

// ── DNA da cena por estúdio e quadrante (múltiplas variações) ───────
type SceneDNA = { scenario: string; motion: string; camera: string };

const STUDIO_SCENE_DNA: Record<string, Record<Quadrant, SceneDNA[]>> = {
    kyoani: {
        PositivoAtivo: [
            { scenario: "festival escolar ensolarado, cerejeiras, luz quente de fim de tarde", motion: "girando de alegria, saia esvoaçando, olhos brilhantes", camera: "plano médio, bokeh quente de lanternas ao fundo" },
            { scenario: "praia no verão, brisa no cabelo, céu azul cristalino", motion: "correndo em direção à água, rindo alto e convidativamente", camera: "plano dinâmico acompanhando o ritmo, luz solar estourada ao fundo" },
            { scenario: "sala de clube musical, tarde dourada, poeira visível no raio de sol", motion: "tocando instrumento invisível com empolgação total", camera: "close-up em sorriso afetuoso, profundidade de campo rasa" }
        ],
        PositivoCalmo: [
            { scenario: "café silencioso junto a janela com chuva, chá fumegando", motion: "lendo em silêncio, leve sorriso, fones no pescoço", camera: "close-up íntimo, fundo suavemente desfocado" },
            { scenario: "biblioteca antiga, raio de luz iluminando poeira no ar", motion: "folheando página gentilmente, olhar sereno e focado", camera: "plano médio de perfil, paleta quente de madeira" },
            { scenario: "varanda de casa, final da tarde, brisa fresca de outono", motion: "espreguiçando-se suavemente, olhos fechados desfrutando o momento", camera: "plano contido e pacífico, simetria relaxante" }
        ],
        NegativoAtivo: [
            { scenario: "entrada da escola na chuva, alunos apressados, chuva pesada", motion: "segurando a maçaneta sem abrir, dedos tensos", camera: "close-up nas mãos, emoção lida pela tensão e gotas d'água" },
            { scenario: "cruzamento urbano noturno, luzes de neon desfocadas", motion: "correndo desesperadamente, chorando com força, respiração ofegante", camera: "seguir no nível dos olhos, câmera na mão levemente instável" },
            { scenario: "corredor escuro da escola após o pôr do sol", motion: "batendo no armário com frustração crua, lágrimas caindo", camera: "plano focado nas costas tensionadas e respiração" }
        ],
        NegativoCalmo: [
            { scenario: "terraço vazio ao entardecer, cidade sumindo na luz violeta", motion: "encostada na parede, joelhos recolhidos, rosto virado", camera: "recuo de close para plano aberto isolado" },
            { scenario: "quarto escuro de madrugada, única luz pálida da lua", motion: "encarando o teto sem piscar, olhar perdido e vazio", camera: "top-down shot vertical, figura pequena cercada de sombras" },
            { scenario: "vagão de trem vazio à noite, luzes ritmadas da cidade passando", motion: "encostado no vidro frio, suspirando silenciosamente", camera: "foco profundo no reflexo transparente no vidro da janela" }
        ],
        Centro: [
            { scenario: "terraço da escola entre aulas, vento contínuo, nuvens rápidas", motion: "peso mudando de um pé pro outro, olhando pra baixo em ponderação", camera: "composição passiva centrada" },
            { scenario: "caminhando para a escola sob luz banal da manhã", motion: "passos ritmados, olhar à frente sem pensar muito", camera: "acompanhamento lateral plano" }
        ],
    },
    ghibli: {
        PositivoAtivo: [
            { scenario: "voando acima das nuvens em criatura espiritual, sol rompendo", motion: "braços abertos em voo livre, roupa ao vento selvagem", camera: "plano aberto dramático, horizonte imenso curvado" },
            { scenario: "prado enorme na montanha varrido pelo vento sob nuvens brancas", motion: "correndo em descida rindo descontroladamente", camera: "panorâmica grandiosa acompanhando figura minúscula na vastidão" },
            { scenario: "mercado em cidade mágica lotada de barracas e bandeiras", motion: "comendo avidamente um pão quente, bochechas cheias", camera: "dinâmica de rua, calor humano saturado" }
        ],
        PositivoCalmo: [
            { scenario: "beira de riacho sereno refletindo pedras musgosas", motion: "mergulhando as mãos na água fresca, expressão relaxada", camera: "ângulo rente à água borbulhando suave" },
            { scenario: "jardim secreto abandonado mas cheio de flores silvestres", motion: "dormindo encolhido na grama alta respirando devagar", camera: "cenário absorvendo o personagem, escala da natureza opressivamente bela" },
            { scenario: "cozinha aconchegante cheia de panelas, lareira queimando", motion: "cortando vegetais em ritmo estável e tranquilo", camera: "estabilidade total, calor em cores quentes da lenha" }
        ],
        NegativoAtivo: [
            { scenario: "tempestade colossal avançando sobre o mar, rochas castigadas", motion: "gritando contra o vendaval agarrado numa estaca", camera: "escala épica aterrorizante, fúria dos elementos naturais" },
            { scenario: "floresta sombria sendo consumida por lodo negro espinhoso", motion: "correndo lutando pela vida enquanto desvia de gavinhas", camera: "tilt desesperado para cima e para baixo" },
            { scenario: "oficina mecânica caótica pegando fogo em tom industrial avermelhado", motion: "tentando fechar válvula pesada sob chuva de faíscas", camera: "dutch angle desorientador no olho do fogo" }
        ],
        NegativoCalmo: [
            { scenario: "ruína de pedra coberta de musgo na luz difusa de floresta fria", motion: "sentado nos degraus de braços cruzados num silêncio profundo", camera: "recuo letárgico enfatizando a idade do cenário" },
            { scenario: "ilha minúscula à deriva num oceano morto e liso", motion: "olhando linha reta do horizonte imutável sem piscar", camera: "wide estático absurdo, desolação aquática" },
            { scenario: "quarto coberto de pó e teias onde tempo parou", motion: "varrendo lentamente sozinho, sem energia ou propósito", camera: "enquadramento triste através da fresta de porta velha" }
        ],
        Centro: [
            { scenario: "trilhos submersos da balsa se perdendo mar adentro num céu espelhado", motion: "com malas na mão olhando para a passagem de transição", camera: "simetria absoluta no espelho d'água" },
            { scenario: "campo raso de grama dividindo cidade mecânica e floresta orgânica", motion: "andando de um lado sem olhar os extremos", camera: "equilíbrio liminar contido" }
        ],
    },
    ufotable: {
        PositivoAtivo: [
            { scenario: "noble phantasm ativado, realidade fraturando em ouro glorioso", motion: "arma em arco de luz, círculos mágicos nos pés", camera: "arco dinâmico 3D 360°, câmera acompanhando efeito de partícula esmagador" },
            { scenario: "golpe elemental colossal destruindo demônio ao relento noturno", motion: "avanço com rastro explosivo brilhante tipo fogo aquático", camera: "slow-motion extremo mudando bruscamente para speed ramp caindo pro eixo horizontal" }
        ],
        PositivoCalmo: [
            { scenario: "pátio lunar após carnificina, neve caindo, cenário estilhaçado relaxando", motion: "limpando espada lenta e calmamente guardando na bainha", camera: "push in incrivelmente detalhado focando ponta laminada" },
            { scenario: "interior de casa de madeira antiga sob chuva suave na varanda", motion: "tomando uma xícara em repouso após noite desgastante", camera: "planos estáticos em objetos (pingo dágua caindo, luz nos olhos)" }
        ],
        NegativoAtivo: [
            { scenario: "cidade ruindo magicamente via linhas ley e crateras vermelhas no ar", motion: "recebendo golpe destruidor e voando por paredes", camera: "cinematografia agressiva caótica com tremor gigante, muito debris e smoke" },
            { scenario: "chamas negras inextinguíveis iluminando combate desesperado e suado", motion: "cortando em fúria cega enquanto corpo fumaça de desgaste", camera: "câmera super-grande angular na arma sendo forçada goela abaixo" }
        ],
        NegativoCalmo: [
            { scenario: "igreja bombardeada desmoronada, estátua esfacelada coberta de luto e poeira mágica descendo", motion: "ajoelhado sem força alguma de frente ao quebrado da vida", camera: "dolly out suave mostrando toda fumaça espessa volumétrica" },
            { scenario: "dimensão sombria nula, gelo quebrado e ecos distantes azuis", motion: "deitado ferido encolhido de frio e morte em suspensão", camera: "top view fria estirada mostrando minúsculo humano em vastidão" }
        ],
        Centro: [
            { scenario: "passarela entre realidades espelhada refletindo um abismo estelar incolor", motion: "andando a esmo na linha prateada não dando importância para as galáxias", camera: "órbita perfeita mantendo eixo rotativo limpo" },
            { scenario: "centro caótico do universo desmoronando no vazio pausado magicamente", motion: "estátua humana na poeira suspensa analisando futuro", camera: "cenario complexo 3D contra modelo inerte estático desenhado em 2D cell-shading" }
        ],
    },
    mappa: {
        PositivoAtivo: [
            { scenario: "terraço escuro de Shibuya com neon forte saturado inundando cimento", motion: "grito gutural de glória com sangue escorrendo no punho, Black Flash pronto", camera: "fish-eye ultra dinâmico deformando periferia da câmera, FOV absurd" },
            { scenario: "batalha insana e estilosa de breakdance com armas brancas caindo", motion: "esquiva perigosa seguida de sorriso insano de maníaco confiante", camera: "snapping cut e tracking maluco grudado no peito em ação" },
            { scenario: "estacionamento fechado, faróis de moto ofuscando neblina densa, skate no ar", motion: "acelerando para a vitória com adrenalina urbana", camera: "motion-blur realista alto puxando de baixo pro alto" }
        ],
        PositivoCalmo: [
            { scenario: "izakaya miúdo lotado iluminado a óleo amarelo, fumaça quente subindo e barulho abafado", motion: "escorado balançando o copo de cerveja quase sorrindo", camera: "mise-en-scène intimista, claustrofobia mas de paz em companhia humana" },
            { scenario: "apartamento apertado e sujo bagunçado japonês pós-jantar do conbini caindo de sono", motion: "cabeça na perna de um aliado respirando seguro pela primeira vez", camera: "perfil despojado cru de dia correndo normal" },
            { scenario: "pontilhão na maré baixa em riacho sujo da cidade ouvindo cicadas", motion: "olhando água descendo mastigando algo distraidamente", camera: "escala humana reduzida frente ponte pesada opressiva crua" }
        ],
        NegativoAtivo: [
            { scenario: "expansão de domínio diabólico desfigurando ar real, corpos multilados suspensos chovendo sangue", motion: "carregando poder maldição nas mãos urrando até estourar veias pescoço em grosseria", camera: "freeze frame bizarro distorcendo em aberração cromática hardcore" },
            { scenario: "desmoronamento caótico e vertigem da escadaria sem fim, pânico generalizado na sujeira e entulho caindo", motion: "apanhando brutalmente com violência visceral cruzerificando corpo ao chão", camera: "handheld sujo e confuso de impacto na carne pura tremendo" },
            { scenario: "fuga de carnificina em viela molhada em lodo escuro sentindo fedor", motion: "tropeçando de cansaço arrastando cano pra não morrer tremendo de cólera", camera: "shaky-cam agressivo close focado só nos olhos alucinados e pupila contraída" }
        ],
        NegativoCalmo: [
            { scenario: "pós-chacina urbana na praça abandonada fedendo ferro, cadáver de companheiro em lado fora quadro", motion: "corpo inerte escorado parecendo lixo encostado em caçamba suja chovendo no capuz molhado colado corpo inteiro", camera: "zoom lerdo cruel que não alivia a carga do perceptor escuro e alto-contraste" },
            { scenario: "sala da diretoria silenciosa no amanhecer trágico escuro vazio insustentável de pesar mudo, luz fluorescente falhando chiando elétrico num canto", motion: "fechando as mãos ate rasgar pele encarando nada no ar cego e cínico sem esperança, cabeça entre as unhas rasgadas", camera: "close em parte anatômica isolada focando na iluminação dramática esticada vertical e sombras texturizadas densas" }
        ],
        Centro: [
            { scenario: "liminar entre zona normal e maldição onde calçada transiciona para orgânico pulsado sutilmente no breu cego de uma viela estreita isolada do barulho central limpo japonês médio com placas luminescentes e texturadas pesadas", motion: "parado fumando ignorando abismo olhando algo em seu telefone rachado na tela suja de cimento cru e vida monótona", camera: "escala equilibrada frontal de cintura dura fotográfica seca" },
            { scenario: "praça na madrugada onde 3 caminhos divergem vazia sombria mas estanque e pacata cheirando asfalto lavado neblina urbana pesada sem tráfego sem sons noturnos sem pressa real no silêncio urbano", motion: "saco plástico girando no chão em looping enquanto olha céu acastanhado poluído refletindo lâmpada laranjada em postura curvada folgada", camera: "composição sem hierarquia morta cinza sem julgamento e dura como fotografia real urbana" }
        ]
    },
    shaft: {
        PositivoAtivo: [
            { scenario: "arquitetura impossível desabando em vitrais neofauvistas quadriculados abstratos de pura cor, infinito vermelho carmim neon e ciano pastel surreal chocante visual", motion: "cabeça virada na quebra de nuca estilo Shaft clássica, gargalhada demente irônica de poder pleno insano focado direto no espectador esmagando 4a parede sem medo com arame farpado decorativo", camera: "zoom loop hiperestilizado com texturas e colagens geométricas explodindo num flat design insano" },
            { scenario: "caixa espacial de tetris flutuando caindo rápido em padrões padronizados de texturas japonesas reticuladas com nuvens perfeitamente vetoriais desenhadas cortando papel de origami de fundo dinâmico vibrante pop art forte choque cromático extremo absurdo", motion: "dançando passos desencaixados cortados em staccato ritmado perfeitamente quebrando a anatomia logicamente esteticamente pra pose de super herói de vanguarda no ar e com silhueta perfeita", camera: "ângulo escorregando dutch louco em quadro dividido por frames pretos e cards escritos num flash" }
        ],
        PositivoCalmo: [
            { scenario: "escadarias espirais infinitas de escola deserta mergulhadas na golden hour âmbar laranjado banhado numa melancolia arquitetônica silenciosa bizarra imensa gigante monolitica monumental brutalista moderna, sol cravando janelas enormes com poeira no ar estanque pacato", motion: "figura esguia encostada como uma estátua etérea sorrindo sozinha enquanto formas surreais levitam do seu lado pacíficas lentas suaves como peixes flutuando onírico em paz surreal suspensa", camera: "cenário absorvendo eixo no infinito de ponto unico estagnado e frio porem quente na paleta" },
            { scenario: "planície infinita de xadrez preto branco perdendo no horizonte e cadeiras escolares viradas organizadamente meticuloso formando uma rosa visto de cima estático sem vento sem som total", motion: "deitado simetricamente no centro exato absorvendo uma carta que nunca muda posição", camera: "tracking shot muito lerdinho sem variação visual perfeita na linha de horizonte flat chapado" }
        ],
        NegativoAtivo: [
            { scenario: "claustrofobia gráfica extrema em sala vermelha espremida com grades pontudas caindo do teto simbolizando prisão emocional metafórica demente escura texturizada com fotos coladas reais perturbadoras macabras oníricas surrealista bruxas pesadelo vivo caótico frenese em fita crepe preta adesiva e tinta óleo seca gotejando sangue falso e olhos na parede te julgando", motion: "contorção física gritante correndo em lugar nenhum rodopiando contra paredes que viram chão num loop sádico eterno preso amarrado desespero rasgado de alma atormentada de verdade suja cortada esteticamente genial absurdo violento de se ver e sentir o pavor psicológico expresso", camera: "close bizarro nos olhos texturizados e pupilas trementes mudando para panorâmicas distorcidas 180° que fecham porta atrás do espectador num flash corte seco aterrorizante da sua psique humana rachando" },
            { scenario: "teatro de sombras caindo cortinas grossas em espiral pesadelo mental geométrico em tom sépia desespero rasgando estourado as texturas coladas cortando papelão rasgado insano caos total e queda livre perpétua em buraco num corredor de fechaduras velhas imensas roxas", motion: "caindo agarrando se a gesso tentando quebrar unhas quebrando tudo de nervos gritos inaudíveis sufoco em desolação completa insana quebrando física visual da dor sem filtro em desconstrução brutal desfragmentada ciente do pesadelo irreal acordado ativamente resistindo furiosamente", camera: "rotação 3d em câmera 2d mentirosa e cheater que brincando de MC Escher e labirinto infinito esmagadoramente inclinado num ângulo impossível onde topo chao e esquerda e cima se mistura num horror geométrico inegável da psique humana em terror e psicose estilhaçada absurda doidinho visual brutal e inovador demais loucura plástica insana" }
        ],
        NegativoCalmo: [
            { scenario: "sala vazia abstrata branca pura infinita sem teto com teto vazado escuro breu só silhueta de uma gaiola aberta com chave distante no infinito frio da falta de resposta apatia e futilidade visual metafórica e dolorosamente estanque pálida e crua seca gelida dura", motion: "sentado na cadeira clássica de perfil esquerdo curvado cabeça entre as pernas imobilizado estátua em desalento puro de quem já desistiu da forma original e só é geometria agora esquecida inerte fútil amarga triste quieta morta fria inexpressiva dura apática fria doída parada travada no tempo da dor emocional seca e contida cínica exaurida exausta derrotada humilhada abandonada vazia gasta e desgastada triste pra sempre parada cravada estólida pálida oca morta em vida passiva congelada morta congelada ali morta ali congelada estanque crua limpa morta fria pura pura triste", camera: "composição frontal 100% perfeita na divisa de centro na tela sem respiro lateral com margens simetricamente pensadas asfixiante num minimalismo negativo puro em vazio total sem música sem ar sem espaço limpo doído cru frio duro pesado insosso exato doloroso cínico calculista rígido engessado travado focado direto passivo e observador e julgador duro de olhar impassível formal seco rígido" },
            { scenario: "apartamento surreal onde móveis estao de ponta cabeça mas a gravidade ta normal mas tudo em volta e roxo escuro desolado com uma televisão com chiado cinza solitário apático zombando vazio sombrio estéril de afeto na geometria", motion: "friccionando braço passivamente olho vidrado tela cega piscando lenta e dolorosamente", camera: "camera embutida na parede ignorando o chão focando no silêncio entre linhas retas cortadas secas" }
        ],
        Centro: [
            { scenario: "estrada reta de semáforos paralelos alinhados ao infinito todos no vermelho sem fim esperando tempo nenhum transcorrer vazio total despojado sem drama ou paz só o fluxo monótono paralisado de geometria crua de cidade suspensa na fresta entre dia noite com relógios sem ponteiro pontilhados no horizonte irreal branco leitoso de fundo cego insosso opaco inofensivo plano duro irônico e estático neutro sem opinião isento morno quieto formal linear liso chapado limpo gráfico sem vida em suspensão crua plástica", motion: "parado milimetricamente esperando estático como manequim na calha cru em design sem expressar vida parecendo item de inventário ou estátua esquecida esperando script de cena passivamente ali isento apático neutro cínico ausente aguardando comutação sem emoção lida cego de afeição parado no lugar inorgânico em si de alma fútil no momento irresoluto inerte paralisado formal", camera: "wide e simetria de horizonte cravada meio termo em perfeccionismo neurótico cru com quadro dividindo a esquerda de vermelho direita azul" },
            { scenario: "plataforma preta rodeada de brancura imaculada com 1 poste isolado brilhando opaco refletivo limpo geométrico exato em matemática de proporção com linha demarcando limites perfeitos e distantes passivo isolacionista frio inumano de espaço e forma inerte liso chapado vetorial sintético", motion: "cruzando perna numa cadeira sem balançar o pe impassível sem expressar pensamento isolado e sem necessidade de pertencer isolado perfeitamente fechado em forma sem vontade e sem recusa focado no ar transparente apático distante frio isento isolacionista robótico de afeto em design abstrato duro e reto estático geométrico", camera: "panning cravado liso sem ressalto sem emoção linear maquina documentário clinico analise in vitro esteril liso em laborio visual" }

        ]
    },
    trigger: {
        PositivoAtivo: [
            { scenario: "cabine mecha gritando luz néon colorida de explosões estelares, espaço sideral curvo em túnel superluminal saturado energia caótica pop exagerada neon punk fogo chamas", motion: "braços em cruz com capa explodindo em 10 metros, grito insano sorridente rindo dente grande hiper empolgado confianca total pose Gainax exagerada insana fúria animal", camera: "escala bizarra de zoom in distorcida para a fuça com lente aberrante olho louco e poeira estrela fogo colidindo na cara suada vibrando impacto treme tremor câmera epilético super" },
            { scenario: "cidade hiper tech pulando sob vulcão ativo chamas cartoon roxas super flat manga design fogo e explosão pop com asteroides caindo explodindo felizes radiantes de acao non stop hiper cinética loucura visual extrema estourada insana radical estúpida foda hardcore absurda over the top punk estilosa", motion: "chutando céu pro alto saltando 2 kilometros fogo no pé silhueta elástica smeareando flexível comendo poeira subindo pra cima foda orgulhoso sorriso rasgado cara deformada insano foda epico", camera: "tracking de speedlines estourando do centro explodindo lente da tela forçado perspectiva ultra extrema 3 pontos gigante" }
        ],
        PositivoCalmo: [
            { scenario: "topo montanha escarpada quadrada poligonal estilizada vento farto nuvens fofas super delineadas céu azul 100% saturado por do sol impossível magenta laranja hiper vivo cores estopadas cartoon liso sem degrê chapado quente vibrante nostálgico irreal punk feliz", motion: "sentado borda penhasco balançando calcanhares fumando/comendo pão relaxadasso pernas cruzadas braço atrás cabeça vento batendo rabo capuz ou cachecol espetado no vento louco 1 metro pose confiante marrenta vitoriosa pós-luta foda em paz", camera: "contra mergulho da bota pra cima olhando vastidão epica de silhueta forte cravada foda no centro gigante da visão" },
            { scenario: "deserto liso de areia brilhosa estrela cadente cruzando de um lado a outro cruz colorida imensa na areia calor palpável neon vibrando cactos estilisadissimos pop cartoon afiado sem curvas", motion: "acampando peito nu suado encostado em arma gigante ou moto bizarra dormindo babando num sono ruidoso caótico mas profundo relaxo feliz sorrindo e esparramado grandioso em poses estúpidas engraçadas e em paz grandona confiante exausto calmo roncando duro esparramado total em esticada manga", camera: "ângulo panorâmico mostrando traquilidade heroica gigantesca em silêncio barulhento colorido vivo no estilo Trigger vibrante limpo estático de cena de termino e ending" }
        ],
        NegativoAtivo: [
            { scenario: "nuvem cogumelo neon toxico ciano vermelha em cidade desabando blocos gigantes de predio espetado pontudos voando fumaça cinza pesada e detritos estilizados geométricos como triangulos lousangos fogo fagulha morte caos epico tragédia destrutiva e apocaliptica ultra dinâmica exagerada destruição colossal total catastrófica 2d chapada hardcore punk anarquia caos sangue estilizado vermelho fita preta punk sujo arranhado estressante violento caos caindo morte esmagadora fumaça dura fogo e laser colisão galáxia rasgada caindo furia cósmica hiperviolenta animal instintiva", motion: "investida da morte rasgando asfalto puxando catana absurda de fogo ou furação nos punhos derramando sangue raiva em careta grotesca distorcida rangendo os dentes rugido de animal pupila esbranquiçada aura de desespero irado ódio concentrado explosão mental em frenesi insana ataque violento de choque animal demente caçador feroz rasgando o ar smear distorcido pra porrada da vida do ódio fúria colérica loucura doída destrutiva visceral estapafúrdia em chamas cega e desesperada na luta contra desamparo e raiva bruta solta sem amarra cega em ira colossal", camera: "esbarro estourado e tremida gigante câmera colidida zoom chicote do nada dutch do avesso giro em peão acompanhando sangue voar ou fogo no centro chapando a tela e deformando extremidades num olho peixe da agonia furiosa pesadelo e ação frenética sem freio vertiginosa na batida louca sem respiro num strobe light bizarro genial dinâmico rápido quebra pescoço sádico pesado sujo focado impacto soco doído pesote" },
            { scenario: "corredeira de lava radioativa em ponte estilhaçada neon quebrado breu iluminado no desespero total e lamas negras do espaço colosso em pavor fumaça sufocaste e detrito cartoon chapado angular voador destrutivo fim do mundo caindo", motion: "berrando caindo fugindo caindo escorregando agarrado pendurado careta da dor absurda braço sangrando exageradamente ódio raiva e medo cartoon trágico feio visceral em choque hiperativo destrutivo furioso fugindo ou voltando num coice agressivo", camera: "POV vertigem descendo queda insana estourada no motion linhas de speed bizonhas roxas grossas de dor" }
        ],
        NegativoCalmo: [
            { scenario: "cenário liso raso limpo queimado escuro de fim de combate cinza apagado fumaças escuras no pó cinzas no ar silêncio de morte estrelas vermelhas fracas fundo vazio limpo cínico isolado depois da explosão resto lixo despojo metal derretido arame e chão queimado", motion: "largado caído de costas estirado olho esfaqueado vida na ultima braço torcido manga trapo rasgado calmaria derrotada mas imponente teimosa cansada acabada no chão liso moribundo trágico e espetacular melancólico épico de luto mudo derrotado cínico na poeira final frio caído em lixo mudo", camera: "visão do céu enorme liso vazio opressor focando da figura trágica pequena do centro exausta e destruída flat e marcante num poster epico caindo mudo frio distante inerte inoperante esmagado na calmaria de enterro dramática épica triste dolorida heróica porém letal sombria num isolamento final cego distante morto exausto cru de vida inútil final fechado dramático heroico póstumo estático total e focado no luto monumental frio na tela de cena estática longa" },
            { scenario: "chuva cortante neon neon sujo cinza pesado e roxo sombrio chão asfalto afiado bueiro saindo neblina estática solidão cyberpunk doída triste e escura e pingos de chuva quadrados e duros opressores em dor abafada sem musica", motion: "escorado parede jaqueta alta olho fechado fumando chuva apagando isqueiro teimoso ranzinza machucado dolorido cinico em fim de historia sozinho fodido", camera: "perfil 100% de lado silhueta negra recortando na cortina de chuva cinza duro e chapado sujo estanque" }

        ],
        Centro: [
            { scenario: "pista de treino monocromática cinza e roxa vazia com demarcações duras irreal estúdio escuro sem mobília ou contexto abstrato base liminar de esquadrão sem ação sem nada no fundo chapada vazia isenta estagnada sem vento flat clean sem enfeite neutra de evento aguardando ou pausada pra comédia lida", motion: "parado mascando chiclete coçando o rosto cara de tédio ou apatia cômica olho redondo ponto ignorando leitor ou evento calmo atrevido neutro isento folgado postura manga displicente aguardando tempo passar neutro normal passivo chato mas estilizadasso manga afiado despojado rebelde passivo apatico isento neutro esparramado desinteressado normal de boas parado neutro atoa e solto ignorando plot apático passivo de boas isento passivo indiferente relaxadão normal desinteressado pacato e folgado moleque isento folgado e blasé focado", camera: "composição cravada chao cintura média perfeitamente lida como uma arte character sheet frontal cínica irônica plana dura plana e objetiva sem emoção nenhuma inorgânica plástica plana lisa estolida folgada flat lida neutra formal lida lida seca dura sem sombra lida seca lida crua foda chapada nítida seca" },
            { scenario: "fundo de velocidade speedline monocromático preto e roxo travado no tempo do corte sem cenário real abstração limpa de momento interativo focado no meio ou um quarto cinza chapadona", motion: "ombros caídos encarando câmera com gota de suor na cabeça pose SD manga exagerada ou perfeitamente estúpida isenta blasé confusa irônica irresoluta de cara branca ignorando algo estupido isento apatia ignorando problema ou comendo moscas em stand by normal passiva solta sem esforço desinteressada e fútil manga normal paralisada pasma confusa abençoada estúpida mole inerte isenta apática inerte de ação isenta inútil isenta ignorante boba lida boba solta cínica limpa chula flat cômico nula na espera tonta plana oca chata boba cômica e blasée inerte", camera: "frontal 100% quadro duro cômico liso sem perspectiva exagerado pra flat irônico estático cru morto sem esforço de angulo banal comum inodoro indolor fútil plástica boba fútil seca boba formal lida nítido isento frio duro." }
        ]
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
        const dnaList  = STUDIO_SCENE_DNA[studio.id]?.[quadrant];
        const dna      = dnaList ? this.random(dnaList) : null;
        // const nuance   = MOOD_NUANCE[moodKey];
        const actMod   = activationModifier(data.ativacao ?? 0);

        const scenario  = dna    ? dna.scenario       : "ambiente evocativo";
        const motion    = dna    ? dna.motion         : "pose emocional deliberada";
        const camera    = dna    ? dna.camera         : "plano médio deliberado";
        // const palette   = nuance ? nuance.palette     : "gradação cinematográfica rica";
        // const atmosphere= nuance ? nuance.atmosphere  : "carregado de emoção não dita";
        // const symbol    = nuance ? nuance.symbol      : "detalhe visual significativo";

        const isCelebration = moodKey === "Celebracao" || (data.sentiment && data.sentiment.toLowerCase().includes("conex"));
        const celebrationRule = isCelebration
            ? "\n\nREGRA MÁXIMA: O tema central é CONEXÃO e CELEBRAÇÃO! A cena DEVE OBRIGATORIAMENTE retratar um intuito comemorativo com amigos. O personagem protagonista NÃO está sozinho; ele está rodeado de amigos/companheiros em um momento de união, alegria compartilhada, comemorando, rindo juntos ou em forte laço de amizade. A energia da imagem vibra festa, conexão e companhia."
            : "";

        const faceRef = data.faceReferencePath
            ? "Traduzir identidade facial da referência para o estilo do estúdio. Sem fotorrealismo."
            : "Personagem jovem adulto(a) original.";

        const copyrightRule = "\n\nREGRA ESTRITA DE COPYRIGHT: TODOS os personagens (protagonista e qualquer pessoa no fundo) DEVEM ser 100% originais e genéricos (OCs). É EXPRESSAMENTE PROIBIDO desenhar personagens que se pareçam com personagens existentes de animes para evitar direitos autorais. O anime de referência serve APENAS para guiar o estilo de coloração, luz e traço, nunca o design dos personagens.";

        return `Ilustração 2D anime orginal. Tema: "${data.sentiment}". (Inspirar-se APENAS no estilo de arte de: ${studio.name}, especialmente ${refAnime}).

ESTÚDIO: ${studio.visualLanguage}. ${studio.cinematography}. ${studio.motionStyle}. ${studio.renderingNotes}.

CENA BASE: ${scenario}. POSE BASE: ${motion}. CÂMERA: ${camera}.${celebrationRule}


PERSONAGEM CENTRAL: ${faceRef}${copyrightRule}

SAÍDA: Retrato 9:16, ilustração 2D anime estilizada. NUNCA fotorrealista. Sem texto/tipografia. Reconhecível como arte do estúdio ${studio.company}.`.trim();
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