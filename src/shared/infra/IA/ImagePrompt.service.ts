import { Injectable } from "@nestjs/common";

export type HybridPromptInput = {
    sentiment: string;
    ativacao: number;
    faceReferencePath?: string | null;
    // O que a playlist tem de concreto: é daqui que sai a variedade (o humor sozinho se repete).
    title?: string | null;
    subgenres?: string[];
    songs?: string[]; // "Artista — Música"
    // Sempre retrato 9:16. "cover" = arte de playlist: além do 9:16 (card do perfil), sai dela
    // um recorte 1:1 para a capa do Spotify, então o essencial fica no centro.
    format?: "portrait" | "cover";
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
        symbols: ["a speaker cone shaking dust off", "a spilled drink caught mid-splash", "a sweaty wristband from tonight's show", "headphones flung around the neck, cable swinging"],
        palettes: ["electric yellow and amber highlights against deep shadow", "hot magenta and white from a strobe against blue-black", "acid green and warm skin tones under club lights"],
        cliches: "fireworks, confetti explosions, sparklers, a concert crowd with raised arms, silhouettes against a stage light",
        social: true,
    },
    Celebracao: {
        feeling: "shared joy, the warmth of belonging to a group of people",
        gestures: ["arms around friends' shoulders", "raising a glass or a can in a toast", "dancing badly and not caring", "laughing so hard they have to lean on someone"],
        symbols: ["a table crowded with half-empty cups and plates", "shoes kicked off in a pile by the door", "a phone propped up playing the music, surrounded by snacks", "a hand-written sign taped to the wall", "a group photo just taken, still on the screen"],
        palettes: ["warm coral and gold from lamps and string lights", "late-afternoon orange with teal shadows", "kitchen fluorescent white mixed with a colored party bulb"],
        cliches: "fireworks, sparklers, confetti, balloons, champagne spraying, birthday cake with candles, a stage crowd with raised hands",
        social: true,
    },
    Confianca: {
        feeling: "quiet authority that needs no announcement",
        gestures: ["walking straight toward the camera, unhurried", "leaning back, chin slightly up, steady gaze", "adjusting a jacket cuff without looking"],
        symbols: ["long clean geometric shadows", "an empty road straight to the horizon", "shoes perfectly laced, planted firmly", "a reflection in a shop window that looks back"],
        palettes: ["cool steel blue with lime accents over near-black", "crisp midday white light and hard black shadows", "deep green and brass under evening light"],
        cliches: "business suits in an office, a superhero pose, a crown, a lion, standing on a mountain peak, sunglasses reflecting a city",
    },
    Energia: {
        feeling: "the body at its limit, kinetic potential",
        gestures: ["mid-sprint, one foot off the ground", "skating or cycling fast through the frame", "punching the air"],
        symbols: ["speed lines of passing lights", "a bouncing ball caught mid-flight", "sweat drops flung by a turn of the head", "untied shoelaces whipping in motion"],
        palettes: ["industrial orange and raw cyan over black asphalt", "harsh noon sun with saturated primary colors", "red tail-lights streaking over wet blue streets"],
        cliches: "lightning bolts, electric sparks around the body, an energy aura, explosions behind the character",
    },
    Amor: {
        feeling: "tender closeness to someone, time moving at the rhythm of a heartbeat",
        gestures: ["two hands almost touching", "sharing one pair of earbuds", "looking at someone just outside the frame, softly"],
        symbols: ["pressed flowers in a notebook", "two cups on one table", "a scarf shared between two people", "two toothbrushes in one glass", "a note left on the fridge"],
        palettes: ["blush pink and ivory in soft morning diffusion", "warm lamp amber in a dark room", "pale green and sunlight through leaves"],
        cliches: "hearts, red roses, rose petals, a kiss at sunset, a couple silhouette against the sky, a wedding",
        social: true,
    },
    Paz: {
        feeling: "the silence before the world wakes up",
        gestures: ["eyes closed, face tilted to the light", "lying on the floor listening to music", "slow breath, shoulders dropped"],
        symbols: ["a feather floating in still air", "steam rising from a cup", "a curtain moving in a light breeze", "a cat asleep in a patch of sun"],
        palettes: ["sea-foam green and pale sky blue over cream light", "soft dawn peach and gray-blue", "white linen light with warm wood tones"],
        cliches: "lotus flowers, a meditation pose, zen stones, a Buddha, candles, a sunset over the sea",
    },
    Reflexao: {
        feeling: "an unanswered question, memory and present blending",
        gestures: ["chin resting on a hand, looking far away", "writing something and stopping mid-line", "turning an old photo between fingers"],
        symbols: ["a window reflection overlapping the view outside", "an old cassette tape", "a half-written page with a pen resting on it", "a mug gone cold beside an open book"],
        palettes: ["deep indigo and lavender under a single desk lamp", "overcast afternoon gray with one warm window", "dusty ochre light through blinds"],
        cliches: "a starry night sky, a galaxy, the moon, a person looking at the stars, a thinker pose, question marks",
    },
    Tensao: {
        feeling: "dread of something unsaid and inevitable",
        gestures: ["gripping a phone without answering it", "frozen mid-step, looking over the shoulder", "clenched jaw, knuckles white"],
        symbols: ["a cracked mirror", "a flickering fluorescent tube", "a door left ajar into darkness", "a phone screen with many missed calls"],
        palettes: ["sickly yellow-green light over cold shadow", "a single red exit sign in a dark corridor", "cold blue screen light on a face in the dark"],
        cliches: "monsters, shadowy figures, horror imagery, blood, a knife, storm clouds",
    },
    Revolta: {
        feeling: "anger breaking through, destruction as language",
        gestures: ["shouting into the wind", "kicking over a trash can", "tearing a poster off a wall"],
        symbols: ["shattered concrete with exposed rebar", "spray paint dripping down a wall", "a broken guitar string", "a smashed phone on the pavement"],
        palettes: ["blood red and obsidian with a hard rim light", "sodium orange streetlight over wet black", "harsh white flash against dirty concrete"],
        cliches: "fire, explosions, burning cars, riot police, flags, a raised fist",
    },
    Frustracao: {
        feeling: "friction between what should be and what is",
        gestures: ["hands pulling at hair", "forehead pressed against a wall", "throwing a crumpled paper at a bin and missing"],
        symbols: ["a clock whose hands refuse to move", "a tangled cable that won't come loose", "a vending machine that ate the coin", "a loading bar stuck on a screen"],
        palettes: ["muddy amber and charcoal under harsh overhead light", "greenish office fluorescent over beige", "gray daylight and a flat blue screen glow"],
        cliches: "cartoon anger marks, steam from the ears, a storm cloud over the head, a scream",
    },
    Melancolia: {
        feeling: "bittersweet nostalgia worn down by time",
        gestures: ["looking back at a place already passed", "sitting by a window with a forgotten drink", "tracing a finger on a fogged window"],
        symbols: ["a faded photo booth strip", "an old bus ticket", "a closed shop that used to be a favorite place", "an unwound music box"],
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
        symbols: ["a door ajar with different light on each side", "a train platform between two departures", "a coin in mid-flip", "two unsent messages on a screen"],
        palettes: ["split light: warm amber on one side, cool blue on the other", "twilight where sky and streetlights are equally bright", "muted olive and mauve in even light"],
        cliches: "a face split in half, yin and yang, a literal fork in the road sign, a person split in two",
    },
};

// Palavra-chave do subgênero (minúsculas, pt/en) → mundos visuais daquela música.
const GENRE_WORLDS: { keys: string[]; worlds: string[] }[] = [
    { keys: ["rock", "punk", "grunge", "emo", "metal", "hardcore", "garage"], worlds: ["a cramped rehearsal room full of amps and cables", "a small live venue seen from the side of the stage", "a garage with a drum kit and taped setlists", "a night bus stop covered in band stickers"] },
    { keys: ["rap", "hip hop", "hip-hop", "trap", "drill", "grime", "boom bap"], worlds: ["a basketball court under sodium streetlights", "an apartment rooftop above a dense city", "a late-night convenience store", "the stairwell of a housing block"] },
    { keys: ["funk", "baile"], worlds: ["a street party on a neighborhood court with towering speakers", "a hillside alley at night under string lights"] },
    { keys: ["house", "techno", "edm", "eletr", "electr", "drum and bass", "dubstep", "synth", "rave"], worlds: ["a warehouse club in strobe haze", "an empty subway platform at 4am after a party", "a bedroom studio full of synthesizers", "a highway at night seen from a moving car"] },
    { keys: ["mpb", "bossa", "samba", "pagode", "forró", "forro", "axé", "axe", "brasil"], worlds: ["a sidewalk bar table in a Brazilian city", "a kitchen with a radio and an open window onto a hot street", "a beach boardwalk at dusk", "a tiled apartment balcony full of plants"] },
    { keys: ["sertanejo", "country", "folk", "bluegrass", "americana"], worlds: ["a dirt road beside a sugarcane field", "the porch of a farmhouse", "the bed of a pickup truck under the stars"] },
    { keys: ["jazz", "soul", "blues", "r&b", "rnb", "neo soul", "motown"], worlds: ["a small jazz bar lit by a single stage lamp", "a record store aisle", "an apartment at night with vinyl records on the floor"] },
    { keys: ["lo-fi", "lofi", "indie", "bedroom", "dream pop", "shoegaze", "alternative", "alternativo"], worlds: ["a cluttered bedroom with posters and a cassette player", "a laundromat at night", "a small-town train platform", "a thrift store"] },
    { keys: ["classical", "clássic", "classic", "orchestr", "piano", "soundtrack", "trilha", "ambient"], worlds: ["an empty concert hall", "a piano beside a tall window", "a misty forest trail"] },
    { keys: ["k-pop", "kpop", "j-pop", "jpop", "pop", "dance"], worlds: ["a shopping street under bright signs", "a karaoke booth", "a dressing room mirror framed by bulbs"] },
    { keys: ["gospel", "worship"], worlds: ["a small church in morning light"] },
    { keys: ["reggae", "dancehall", "reggaeton"], worlds: ["a seaside shack with a sound system", "a sunny street corner with a speaker on a chair"] },
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
    { text: "No people: a still life of the place and objects, with a trace of someone who was just there.", person: false },
    { text: "A small group of friends in the scene; the connection between them is the subject.", person: true, social: true },
];

const AVOID = "school uniforms, classrooms, cherry blossoms, generic sunset, a character smiling at the viewer, centered pin-up pose, lens flare, glow, heavy bokeh, a single color filter over the whole image, text, logos, album covers, real people or existing characters";

function energy(ativacao: number): string {
    if (ativacao > 0.6) return "high: motion blur, dynamic angle, compressed time";
    if (ativacao > 0.2) return "moderate: the scene is in motion, the person is engaged";
    if (ativacao > -0.2) return "balanced: subtle movement, composed";
    if (ativacao > -0.6) return "low: slow, contemplative, absorbed";
    return "almost still: dust in a beam of light, stillness is the theme";
}

@Injectable()
export class ImagePromptService {

    build(data: HybridPromptInput) {
        const moodKey = this.normalizeMoodKey(data.sentiment);
        const mood = MOODS[moodKey];
        const hasFace = Boolean(data.faceReferencePath);

        const subgenres = (data.subgenres ?? []).filter(Boolean).slice(0, 3);
        const world = this.random(this.worldsFor(subgenres));
        const composition = this.random(COMPOSITIONS.filter(c =>
            (!hasFace || c.person) && (!c.social || mood.social)));

        const subject = !composition.person
            ? ""
            : hasFace
                ? " The main character is the person in the reference photo, redrawn in this anime style (not photorealistic)."
                : " Characters are original young adults with distinct, specific looks (hair, clothes, build).";

        const music = [
            data.title ? `Playlist title: "${data.title}".` : "",
            subgenres.length ? `Genres: ${subgenres.join(", ")}.` : "",
            data.songs?.length ? `Songs: ${data.songs.slice(0, 6).join("; ")}.` : "",
        ].filter(Boolean).join(" ");

        return `Original 2D anime illustration in the style of Kyoto Animation: soft diffused light, richly detailed everyday backgrounds, subtle acting in the eyes and hands. Style reference only; every character and design is original.

MOOD: ${mood.feeling}.
${music ? `MUSIC: ${music} Let this music decide the setting, clothes, objects and props — the image should feel like it belongs to these songs, not to any playlist. Do not draw the artists.\n` : ""}
SCENE: ${world}. ${composition.text}${subject}${composition.person ? ` Gesture: ${this.random(mood.gestures)}.` : ""}
KEY DETAIL: ${this.random(mood.symbols)}, placed where the eye lands.
LIGHT AND COLOR: ${this.random(mood.palettes)}, coming from real light sources in the scene; natural colors elsewhere.
ENERGY: ${energy(data.ativacao ?? 0)}.
AVOID: ${AVOID}. For this mood also avoid: ${mood.cliches}.

OUTPUT: Retrato 9:16, vertical, 2D anime, never photorealistic, no text.${data.format === "cover"
    ? " Keep the subject and key detail in the middle third — a imagem também será recortada em quadrado para capa."
    : ""}`.trim();
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
