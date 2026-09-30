import { Injectable } from "@nestjs/common";

// Foto de referência da capa: pessoa (selfie, retrato, amigos) vira personagem; qualquer outra
// coisa (paisagem, lugar, objeto, bicho) vira o cenário. `description` vem da leitura da foto;
// `people` diz se aparece alguém nela (rua cheia, gente ao fundo): sem ninguém, a capa não pode ter gente.
export type CoverReference = { kind: 'person' | 'scene'; description?: string | null; people?: boolean };

export type HybridPromptInput = {
    sentiment: string;
    ativacao: number;
    reference?: CoverReference | null;
    // O que a playlist tem de concreto: é daqui que sai a variedade (o humor sozinho se repete).
    title?: string | null;
    subgenres?: string[];
    songs?: string[]; // "Artista — Música"
};

// O prompt vai em inglês: o modelo de imagem segue instruções em inglês com mais precisão.
// Cada imagem sorteia eixos independentes (cenário, composição, gesto, símbolo), e o cenário vem
// do gênero da playlist quando dá: é isso que tira as capas do "menina de anime na escola".

// `palettes`: sorteada por imagem (uma só deixava toda capa do humor com a mesma cor).
// `cliches`: o que o modelo desenha sozinho para aquele humor ("celebration" vira fogos de artifício),
// proibido de forma explícita junto do AVOID geral.
// `feeling` descreve a sensação sem dizer o nome do humor: a palavra ("celebration", "love") puxa o clichê.
type MoodSpec = { feeling: string; gestures: string[]; symbols: string[]; palettes: string[]; cliches: string; social?: boolean };

const MOODS: Record<string, MoodSpec> = {
    Euforia: {
        feeling: "the peak of a night, time suspended at its most alive",
        gestures: ["head thrown back mid-laugh, arms open", "jumping, hair and clothes caught in the air", "eyes shut, singing at full voice"],
        symbols: ["lights still swinging from the ceiling", "a window steamed up from the heat of the crowd inside", "a neon sign buzzing in hot pink", "wet pavement reflecting every light of the street"],
        palettes: ["electric yellow and amber highlights against deep shadow", "hot magenta and white from a strobe against blue-black", "acid green and warm skin tones under club lights"],
        cliches: "fireworks, confetti explosions, sparklers, a concert crowd with raised arms, silhouettes against a stage light",
        social: true,
    },
    Celebracao: {
        feeling: "shared joy, the warmth of belonging to a group of people",
        gestures: ["arms around friends' shoulders", "raising a glass or a can in a toast", "dancing badly and not caring", "laughing so hard they have to lean on someone"],
        symbols: ["a table crowded with half-empty cups and plates", "jackets crowded on the hooks by the door", "string lights zigzagging overhead", "a hand-written sign taped to the wall", "every window of the house lit up"],
        palettes: ["warm coral and gold from lamps and string lights", "late-afternoon orange with teal shadows", "kitchen fluorescent white mixed with a colored party bulb"],
        cliches: "fireworks, sparklers, confetti, balloons, champagne spraying, birthday cake with candles, a stage crowd with raised hands",
        social: true,
    },
    Confianca: {
        feeling: "quiet authority that needs no announcement",
        gestures: ["walking straight toward the camera, unhurried", "leaning back, chin slightly up, steady gaze", "adjusting a jacket cuff without looking"],
        symbols: ["long clean geometric shadows", "an empty road straight to the horizon", "a glass facade catching the sun", "a reflection in a shop window that looks back"],
        palettes: ["cool steel blue with lime accents over near-black", "crisp midday white light and hard black shadows", "deep green and brass under evening light"],
        cliches: "business suits in an office, a superhero pose, a crown, a lion, standing on a mountain peak, sunglasses reflecting a city",
    },
    Energia: {
        feeling: "the body at its limit, kinetic potential",
        gestures: ["mid-sprint, one foot off the ground", "skating or cycling fast through the frame", "punching the air"],
        symbols: ["speed lines of passing lights", "streetlights stretched into streaks", "a flag snapping in a strong wind", "trees bending hard in the wind"],
        palettes: ["industrial orange and raw cyan over black asphalt", "harsh noon sun with saturated primary colors", "red tail-lights streaking over wet blue streets"],
        cliches: "lightning bolts, electric sparks around the body, an energy aura, explosions behind the character",
    },
    Amor: {
        feeling: "tender closeness to someone, time moving at the rhythm of a heartbeat",
        gestures: ["two hands almost touching", "leaning a head on someone's shoulder", "looking at someone just outside the frame, softly"],
        symbols: ["morning light across unmade sheets", "two cups on one table", "two coats on the same hook", "two toothbrushes in one glass", "a note left on the fridge"],
        palettes: ["blush pink and ivory in soft morning diffusion", "warm lamp amber in a dark room", "pale green and sunlight through leaves"],
        cliches: "hearts, red roses, rose petals, a kiss at sunset, a couple silhouette against the sky, a wedding",
        social: true,
    },
    Paz: {
        feeling: "the silence before the world wakes up",
        gestures: ["eyes closed, face tilted to the light", "lying on a sofa, looking at the ceiling", "slow breath, shoulders dropped"],
        symbols: ["plants on the windowsill catching the first light", "steam rising from a cup on the table", "a curtain moving in a light breeze", "a cat asleep in a patch of sun on the windowsill"],
        palettes: ["sea-foam green and pale sky blue over cream light", "soft dawn peach and gray-blue", "white linen light with warm wood tones"],
        cliches: "lotus flowers, a meditation pose, zen stones, a Buddha, candles, a sunset over the sea",
    },
    Reflexao: {
        feeling: "an unanswered question, memory and present blending",
        gestures: ["chin resting on a hand, looking far away", "writing something and stopping mid-line", "turning an old photo between fingers"],
        symbols: ["a window reflection overlapping the view outside", "a desk lamp making the only pool of light in the room", "a half-written page with a pen resting on it", "a mug gone cold beside an open book"],
        palettes: ["deep indigo and lavender under a single desk lamp", "overcast afternoon gray with one warm window", "dusty ochre light through blinds"],
        cliches: "a starry night sky, a galaxy, the moon, a person looking at the stars, a thinker pose, question marks",
    },
    Tensao: {
        feeling: "dread of something unsaid and inevitable",
        gestures: ["gripping a phone without answering it", "frozen mid-step, looking over the shoulder", "clenched jaw, knuckles white"],
        symbols: ["a cracked mirror", "a flickering fluorescent tube", "a door left ajar into darkness", "a phone lit up with many missed calls on a table"],
        palettes: ["sickly yellow-green light over cold shadow", "a single red exit sign in a dark corridor", "cold blue screen light on a face in the dark"],
        cliches: "monsters, shadowy figures, horror imagery, blood, a knife, storm clouds",
    },
    Revolta: {
        feeling: "anger breaking through, destruction as language",
        gestures: ["shouting into the wind", "slamming a hand against a metal door", "tearing a poster off a wall"],
        symbols: ["a cracked concrete wall with exposed rebar", "spray paint dripping down a wall", "a torn poster flapping on a wall", "a phone with a shattered screen, still lit, on a table"],
        palettes: ["blood red and obsidian with a hard rim light", "sodium orange streetlight over wet black", "harsh white flash against dirty concrete"],
        cliches: "fire, explosions, burning cars, riot police, flags, a raised fist, anarchy symbols, skulls",
    },
    Frustracao: {
        feeling: "friction between what should be and what is",
        gestures: ["hands pulling at hair", "forehead pressed against a wall", "crumpling a sheet of paper in one fist"],
        symbols: ["a clock whose hands refuse to move", "a knotted charger cable hanging from a desk", "a vending machine that ate the coin", "a loading bar stuck on a screen"],
        palettes: ["muddy amber and charcoal under harsh overhead light", "greenish office fluorescent over beige", "gray daylight and a flat blue screen glow"],
        cliches: "cartoon anger marks, steam from the ears, a storm cloud over the head, a scream",
    },
    Melancolia: {
        feeling: "bittersweet nostalgia worn down by time",
        gestures: ["looking back at a place already passed", "sitting by a window with a forgotten drink", "tracing a finger on a fogged window"],
        symbols: ["a faded photo booth strip pinned to a wall", "an old bus ticket tucked into a mirror frame", "a closed shop that used to be a favorite place", "a fogged window with a half-erased drawing on it"],
        palettes: ["soft steel blue and lavender in misty light", "faded golden-hour light on old walls", "washed teal and dusty rose"],
        cliches: "rain on every surface, an umbrella, a tear on the cheek, autumn leaves falling, a lone figure in the rain",
    },
    Tristeza: {
        feeling: "grief that has settled in and will not leave",
        gestures: ["knees pulled to the chest, face hidden", "sitting on the edge of the bed, not moving", "face turned away from the room"],
        symbols: ["an empty chair at a set table", "an unread message on a lit screen", "a wilted flower in a glass", "a coat still hanging for someone who left"],
        palettes: ["deep slate and pewter over near-black", "flat gray morning light with no shadows", "dim blue hour with one weak lamp"],
        cliches: "rain streaking a window, tears streaming, a dark raincloud, a broken heart, a crying close-up",
    },
    Vazio: {
        feeling: "numb and disconnected, like static between stations or a lost signal",
        gestures: ["staring at the ceiling without blinking", "sitting still while everything moves around", "holding a phone that shows nothing"],
        symbols: ["a blank screen reflecting a face", "a TV showing static", "an empty swimming pool", "a fridge light on in a dark kitchen"],
        palettes: ["concrete gray and washed-out white, no warmth", "pale fluorescent green on empty tiles", "overexposed noon light that flattens everything"],
        cliches: "a black hole, a void, floating in space, a cracked or faceless person, abstract darkness",
    },
    Ambivalente: {
        feeling: "suspended between two different futures",
        gestures: ["standing at a crossroads, weight on one foot", "half-turned, one hand on a door handle", "looking at two paths without choosing"],
        symbols: ["a door ajar with different light on each side", "a train platform between two departures", "a traffic light blinking yellow over an empty street", "two unsent messages on a screen"],
        palettes: ["split light: warm amber on one side, cool blue on the other", "twilight where sky and streetlights are equally bright", "muted olive and mauve in even light"],
        cliches: "a face split in half, yin and yang, a literal fork in the road sign, a person split in two",
    },
};

// Palavra-chave do subgênero (minúsculas, pt/en) → mundos visuais daquela música.
const GENRE_WORLDS: { keys: string[]; worlds: string[] }[] = [
    { keys: ["rock", "punk", "grunge", "emo", "metal", "hardcore", "garage"], worlds: ["the back alley behind a small club, lit by one bulb over the door", "a skatepark under floodlights", "a cheap motel parking lot at night", "a night bus stop covered in band stickers"] },
    { keys: ["rap", "hip hop", "hip-hop", "trap", "drill", "grime", "boom bap"], worlds: ["a basketball court under sodium streetlights", "an apartment rooftop above a dense city", "a late-night convenience store", "the stairwell of a housing block"] },
    { keys: ["funk", "baile"], worlds: ["a street party on a neighborhood court under string lights", "a hillside alley at night under string lights"] },
    { keys: ["house", "techno", "edm", "eletr", "electr", "drum and bass", "dubstep", "synth", "rave"], worlds: ["a warehouse club in strobe haze", "an empty subway platform at 4am after a party", "a neon-lit overpass in the rain", "a highway at night seen from a moving car"] },
    { keys: ["mpb", "bossa", "samba", "pagode", "forró", "forro", "axé", "axe", "brasil"], worlds: ["a sidewalk bar table in a Brazilian city", "a kitchen with an open window onto a hot street", "a beach boardwalk at dusk", "a tiled apartment balcony full of plants"] },
    { keys: ["sertanejo", "country", "folk", "bluegrass", "americana"], worlds: ["a dirt road beside a sugarcane field", "the porch of a farmhouse", "the bed of a pickup truck under the stars"] },
    { keys: ["jazz", "soul", "blues", "r&b", "rnb", "neo soul", "motown"], worlds: ["a small dim bar lit by a single lamp over the counter", "a late-night diner booth", "a hotel lobby at night with velvet armchairs"] },
    { keys: ["lo-fi", "lofi", "indie", "bedroom", "dream pop", "shoegaze", "alternative", "alternativo"], worlds: ["a bedroom with posters on the walls and fairy lights", "a laundromat at night", "a small-town train platform", "a thrift store"] },
    { keys: ["classical", "clássic", "classic", "orchestr", "piano", "soundtrack", "trilha", "ambient"], worlds: ["a library reading room with tall windows", "a museum gallery at closing time", "a misty forest trail"] },
    { keys: ["k-pop", "kpop", "j-pop", "jpop", "pop", "dance"], worlds: ["a shopping street under bright signs", "a rooftop pool at night", "a dressing room mirror framed by bulbs"] },
    { keys: ["gospel", "worship"], worlds: ["a small church in morning light"] },
    { keys: ["reggae", "dancehall", "reggaeton"], worlds: ["a seaside shack painted in bright colors", "a sunny street corner with a fruit stand"] },
];

const EVERYDAY_WORLDS = [
    "an apartment kitchen at night", "the back seat of a city bus", "a riverside path", "a laundromat",
    "a rooftop with water tanks", "a train crossing the suburbs at dusk", "a convenience store",
    "a park bench in the rain", "the stairs of an old building", "a beach out of season", "a parking garage",
];

// Composições bem diferentes entre si; "person" = precisa mostrar a pessoa (obrigatório com foto de referência).
const COMPOSITIONS: { text: string; person: boolean; social?: boolean }[] = [
    { text: "Close-up: face and hands carry the whole emotion.", person: true },
    { text: "Wide shot: the person is small inside a large space; the place tells the story.", person: true },
    { text: "Seen from behind or in profile, face partly hidden; posture tells the emotion.", person: true },
    { text: "Unusual angle (from below, from above, or through a window/reflection).", person: true },
    { text: "No people: the place itself is the subject, with one quiet trace of someone who was just there (a lamp left on, a chair pushed back, a cup still steaming on a table), never the person.", person: false },
    { text: "A small group of friends in the scene; the connection between them is the subject.", person: true, social: true },
];

// Linha clara (ligne claire): o traço é descrito por inteiro em toda capa. Só o nome do estilo (como era com
// "Kyoto Animation") deixava o modelo cair na média; o que dá identidade é linha, cor e sombra ditas com todas as letras.
const CLEAR_LINE = "every shape outlined with a clean black ink line of one uniform weight (no thick-and-thin variation, no hatching, no sketchy strokes); flat, bright colors laid inside the lines with no gradients and at most one hard-edged shadow shape per surface; places and objects drawn with careful, realistic precision";
const STYLE = `STYLE: Original illustration in the European ligne claire (clear line) comic tradition: ${CLEAR_LINE}; characters slightly simplified, with specific, expressive faces (simple eyes, not anime eyes) and readable body language. Every character and design is original.`;
// Cena sem gente: o estilo não pode falar de olhos, mãos nem personagens (o modelo lê como pedido de personagem).
const STYLE_NO_PEOPLE = `STYLE: Original background illustration in the European ligne claire (clear line) comic tradition: ${CLEAR_LINE}. Every design is original.`;
const NO_PEOPLE = "The frame is completely empty of people: no characters, figures, silhouettes, faces, hands or reflections of someone, not even small in the distance. The emotion comes only from the place, the light and the weather.";
// Símbolos e paletas que só existem com alguém em cena (cabeça, rosto, pele...): ficam fora quando a cena é sem gente.
const NEEDS_PERSON = /\b(people|head|face|neck|skin|hair|planted|looks back)\b/;
// O modelo enche a cena de coisas soltas pelo chão (discos, fitas, papéis, cabos) quando pode pôr "objetos":
// cada objeto vai no lugar dele e o chão fica livre.
const TIDY = "Only the few objects the scene needs, each resting where it naturally belongs (in hands, on a table, a shelf or a wall); the floor and the ground stay clear, and nothing floats, flies or bounces through the air.";
// A música entra pelo lugar e pelo clima, nunca como objeto: sem isso o modelo "ilustra música" com instrumentos,
// notas, discos e fones mesmo quando nada na cena pede.
const NO_MUSIC_OBJECTS = "Show the music through the place, the clothes and the mood only: no musical instruments, music notes, records, cassettes, headphones, speakers or microphones.";
// O detalhe do humor faz parte do lugar. Sorteado sem olhar o cenário e "onde o olho cai", virava um objeto solto
// em primeiro plano (bola quicando numa loja de conveniência, copo transbordando "no bar" onde não há bar).
const DETAIL_RULE = "part of the place itself (a wall, a window, a table or the light), in the background or middle ground, never a loose object on the floor or in the air; if it cannot exist in this place, leave it out";
const OUTPUT = "OUTPUT: Square 1:1 cover image, a clear-line comic illustration with uniform black outlines and flat color, never photorealistic, no text. The whole frame is shown as is (no crop): compose for the square.";

// Com foto, o modelo de edição tende a devolver a própria foto com filtro. "Not photorealistic" sozinho não
// segura: o que segura é descrever o traço (linha, cor chapada, sombra dura) e dizer que a foto é só o layout
// — o que está nela e onde fica continua, a superfície é redesenhada do zero.
const FROM_PHOTO = "TRANSFORM: convert the attached photo into a hand-inked clear-line comic panel. The photo is only the layout: keep what is in it and where it is (composition, shapes, objects, landmarks, recognizable details), but redraw every surface from scratch. Nothing of the photo's pixels, textures or lighting survives.";
const RENDERING = "RENDERING: every edge in the photo becomes a uniform black ink outline; every texture (fabric, foliage, water, sky, walls) becomes one flat area of color with at most one hard-edged shadow shape; small details simplified into clean drawn shapes.";
const AVOID_PHOTO = "photorealism, photographic textures (film grain, fine noise, skin pores, lens blur, HDR), a photo with a filter or a cartoon overlay, 3D render";
const OUTPUT_PHOTO = "It must read as an inked and flat-colored comic illustration, not as a photograph.";

const AVOID_PEOPLE = "people of any kind (characters, figures, silhouettes, crowds, faces, hands, reflections of someone)";
const AVOID = "objects scattered or dropped on the floor, objects floating, flying, bouncing or falling in mid-air, musical instruments, music notes, vinyl records, cassette tapes, headphones, speakers, microphones, clutter, piles of stuff, litter, debris, loose props strewn around the scene, gradients, airbrushed or soft shading, painterly brushstrokes, watercolor washes, hatching, manga screentones, anime-style big eyes, thick-and-thin brush lines, school uniforms, classrooms, cherry blossoms, generic sunset, a character smiling at the viewer, centered pin-up pose, lens flare, glow, heavy bokeh, a single color filter over the whole image, text, logos, album covers, real people or existing characters";

function energy(ativacao: number): string {
    if (ativacao > 0.6) return "high: dynamic diagonal angle, motion shown by the people, the light and a few clean speed lines (objects stay put)";
    if (ativacao > 0.2) return "moderate: the scene is in motion, things are happening";
    if (ativacao > -0.2) return "balanced: subtle movement, composed";
    if (ativacao > -0.6) return "low: slow, contemplative, absorbed";
    return "almost still: dust in a beam of light, stillness is the theme";
}

@Injectable()
export class ImagePromptService {

    build(data: HybridPromptInput) {
        const moodKey = this.normalizeMoodKey(data.sentiment);
        const mood = MOODS[moodKey];
        const reference = data.reference ?? null;

        const subgenres = (data.subgenres ?? []).filter(Boolean).slice(0, 3);
        const music = [
            data.title ? `Playlist title: "${data.title}".` : "",
            subgenres.length ? `Genres: ${subgenres.join(", ")}.` : "",
            data.songs?.length ? `Songs: ${data.songs.slice(0, 6).join("; ")}.` : "",
        ].filter(Boolean).join(" ");

        const { text: scene, people } = reference?.kind === 'scene'
            ? this.sceneFromPhoto(mood, music, reference)
            : this.sceneFromMusic(mood, music, subgenres, reference?.kind === 'person');

        // Humor, luz, energia e proibições são os mesmos com ou sem foto: só a cena muda. Sem gente na cena,
        // o estilo não fala de personagem e pessoas entram no AVOID (senão o modelo põe alguém "para dar vida").
        // Com foto (rosto ou cenário), o estilo abre e fecha o prompt, com o traço descrito: é o que o modelo
        // de edição mais ignora.
        const photo = !!reference;
        return `${photo ? `${FROM_PHOTO}\n` : ""}${people ? STYLE : STYLE_NO_PEOPLE}
${photo ? `${RENDERING}\n` : ""}
MOOD: ${mood.feeling}.
${scene}
LIGHT AND COLOR: ${this.random(this.withoutPeople(mood.palettes, people))}, coming from real light sources in the scene, painted as flat areas of color (light and shadow are separate flat shapes, never a gradient); a limited palette of about five colors across the whole image.
ENERGY: ${energy(data.ativacao ?? 0)}.
AVOID: ${people ? "" : `${AVOID_PEOPLE}, `}${photo ? `${AVOID_PHOTO}, ` : ""}${AVOID}. For this mood also avoid: ${mood.cliches}.

${OUTPUT}${photo ? ` ${OUTPUT_PHOTO}` : ""}`.trim();
    }

    // Sem foto ou com selfie: o cenário vem do gênero e a composição é sorteada (com rosto, sempre com a pessoa).
    private sceneFromMusic(mood: MoodSpec, music: string, subgenres: string[], hasFace: boolean): { text: string; people: boolean } {
        const world = this.random(this.worldsFor(subgenres));
        const composition = this.random(COMPOSITIONS.filter(c =>
            (!hasFace || c.person) && (!c.social || mood.social)));

        const subject = !composition.person
            ? ""
            : hasFace
                ? " The main character is the person in the reference photo (or the people, if there are several), redrawn as described in RENDERING and keeping their likeness (hair, face shape, clothes)."
                : " Characters are original young adults with distinct, specific looks (hair, clothes, build).";

        const people = composition.person;
        const text = `${music ? `MUSIC: ${music} Let this music decide the setting${people ? " and the clothes" : ""} — the image should feel like it belongs to these songs, not to any playlist. Do not draw the artists. ${NO_MUSIC_OBJECTS}\n` : ""}
SCENE: ${world}. ${composition.text}${subject}${people ? ` Gesture: ${this.random(mood.gestures)}.` : ` ${NO_PEOPLE}`} ${TIDY}
DETAIL: ${this.random(this.withoutPeople(mood.symbols, people))}, ${DETAIL_RULE}.`;
        return { text, people };
    }

    // Paisagem, lugar ou objeto: a foto é o cenário (sem sortear mundo nem composição), redesenhada no
    // estilo do Mofy. A luz e a cor da foto não passam: quem manda é a paleta do humor.
    private sceneFromPhoto(mood: MoodSpec, music: string, { description, people = false }: CoverReference): { text: string; people: boolean } {
        const text = `REFERENCE: the attached photo${description ? ` shows ${description}` : ""}. Redraw it as the heart of this cover: keep its place or subject, its framing and its recognizable details, drawn as described in RENDERING. Its original light and colors do not carry over: follow LIGHT AND COLOR below.
${music ? `MUSIC: ${music} Let this music set the atmosphere of the place — the image should feel like it belongs to these songs. Do not draw the artists. ${NO_MUSIC_OBJECTS}\n` : ""}
SCENE: the place or subject from the photo. ${people ? "Only the people already in the photo; no new characters." : NO_PEOPLE} Do not add objects that are not in the photo; the floor and the ground stay clear.
DETAIL: ${this.random(this.withoutPeople(mood.symbols, people))}, ${DETAIL_RULE}.`;
        return { text, people };
    }

    private withoutPeople(options: string[], people: boolean): string[] {
        return people ? options : options.filter(o => !NEEDS_PERSON.test(o));
    }

    private worldsFor(subgenres: string[]): string[] {
        const text = subgenres.join(" ").toLowerCase();
        const match = GENRE_WORLDS.find(g => g.keys.some(k => text.includes(k)));
        return match?.worlds ?? EVERYDAY_WORLDS;
    }

    private normalizeMoodKey(sentiment?: string): string {
        if (!sentiment) return "Ambivalente";
        return Object.keys(MOODS).find(k => k.toLowerCase() === sentiment.toLowerCase()) ?? "Ambivalente";
    }

    private random<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}
