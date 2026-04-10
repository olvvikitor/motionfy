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

// ── Emotional quadrants ───────────────────────────────────────────────────────
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

// ── Per-studio scene DNA by quadrant ─────────────────────────────────────────
type SceneDNA = {
    scenarios: string[];
    motions: string[];
    cameraLanguage: string[];
};

const STUDIO_SCENE_DNA: Record<string, Record<Quadrant, SceneDNA>> = {
    kyoani: {
        PositivoAtivo: {
            scenarios: [
                "school cultural festival, decorations everywhere, warm afternoon light flooding the courtyard",
                "music club live performance on a gymnasium stage, faces lit by stage lights",
                "sunlit school track, sports festival, banners in the wind",
            ],
            motions: [
                "spinning in joy, uniform skirt flaring, eyes bright and laughing",
                "catching a friend mid-stumble, both erupting into laughter",
                "running at full speed down a cherry-blossom corridor, petals flying",
            ],
            cameraLanguage: [
                "mid-shot with shallow depth of field, warm bokeh of lanterns behind",
                "low angle looking up at the character against a blue sky full of streamers",
                "wide shot of the full scene, character small but vivid in the center",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "quiet café corner by a rain-streaked window, a cup of tea steaming",
                "sunlit classroom after everyone left, dust in the light, open notebook",
                "suburban park in late afternoon, bench under a gentle tree",
            ],
            motions: [
                "reading quietly, one hand resting on the open page, slight smile",
                "watching rain on glass, fingertip tracing a droplet downward",
                "sitting cross-legged on a desk, headphones around the neck, eyes closed",
            ],
            cameraLanguage: [
                "intimate close-up on an expression, background beautifully soft",
                "profile shot with a window providing the only light source",
                "over-the-shoulder looking out at the softly lit world",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "rain-soaked school entrance, students rushing past, one figure standing still",
                "practice room after a failed performance, instrument on the stand, tension in the air",
                "dim hallway after a confrontation, footsteps echoing away",
            ],
            motions: [
                "grabbing the handle of a door without opening it, knuckles pale",
                "standing very stiff in heavy rain, not running for shelter",
                "hands pressed to both ears, surrounded by noise and motion",
            ],
            cameraLanguage: [
                "tight close-up on the hands, emotion read through grip",
                "reflection in a rain puddle, character looking down",
                "over-the-shoulder framing, isolating the character from a crowd",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "empty school rooftop at dusk, city fading into orange distance",
                "bedroom at blue hour, window slightly open, curtain moving",
                "train station platform, last train gone, alone under station lights",
            ],
            motions: [
                "sitting against the wall, knees up, face turned slightly away",
                "pressing a hand to a cold window, looking at something outside",
                "staring at a photograph in a softly lit room, expression still and aching",
            ],
            cameraLanguage: [
                "slow pull-back from close to wide, leaving the character very alone in the frame",
                "low static shot at ground level, character's feet the focal point",
                "reflection in a window with the room behind, inside and outside both soft",
            ],
        },
        Centro: {
            scenarios: [
                "school rooftop between classes, wind moving through everything, city visible below",
                "empty classroom, two chairs still facing each other after a conversation",
                "hallway junction, paths in three directions, no one else visible",
            ],
            motions: [
                "weight shifting from foot to foot, looking in two directions",
                "hand raised to knock, pausing before contact",
                "sitting at a desk, pencil mid-air, not writing, not stopped—just hovering",
            ],
            cameraLanguage: [
                "perfectly symmetrical composition, character exactly centered",
                "wide shot in which character stands at an intersection",
                "slow rack focus between two equally important planes",
            ],
        },
    },

    ghibli: {
        PositivoAtivo: {
            scenarios: [
                "soaring above clouds on a spirit creature's back, sun breaking through below",
                "busy fantasy market town, banners flapping, creatures and people everywhere",
                "clifftop overlooking a magical valley, wind strong and warm",
            ],
            motions: [
                "arms spread wide in free flight, hair everywhere, face pure joy",
                "running through a spirit festival crowd, color and light in every direction",
                "leaping from a rooftop into clear sky, a spirit companion beside them",
            ],
            cameraLanguage: [
                "epic wide shot from below the character against a vast azure sky",
                "tracking shot alongside a creature in full flight, horizon tilting",
                "slow gentle crane rising to reveal the full magical landscape below",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "flower meadow in golden hour, a small cottage visible in the valley below",
                "seaside cottage in summer, fishing boats in the harbor, soft wind through grass",
                "ancient forest at dawn, light filtering through enormous trees, spirits drifting",
            ],
            motions: [
                "lying in tall grass looking at clouds, one hand slowly trailing through the meadow",
                "sitting on a stone wall watching the sea, content and nowhere to be",
                "tending something small with great care—a seed, a flower, a spirit",
            ],
            cameraLanguage: [
                "enormous sweeping landscape establishing shot, tiny character at rest",
                "slow drift across a beautiful environment, character in easy companionship with it",
                "gentle low angle from the ground, grass in foreground, character and sky above",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "storm bearing down on a coastal town, sea churning, shutters slamming",
                "ancient spirit's fury made visible—forest shaking, darkness spreading",
                "urgent flight through war-scarred sky, fires below casting upward light",
            ],
            motions: [
                "holding ground against a powerful wind, hair and coat violent with movement",
                "sprinting across a disintegrating bridge over a roiling spirit river",
                "one arm raised to protect, the other reaching for something beyond reach",
            ],
            cameraLanguage: [
                "wide shot showing the full scale of the hostile environment around a small figure",
                "ground-level tracking shot of desperate sprinting, world blurring",
                "tight close-up of a face resolving into courage mid-storm",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "abandoned shrine deep in winter forest, snow settling on stone torii",
                "small boat at anchor in a fog-covered bay, no other boats in sight",
                "overgrown ruins of a mechanical castle, one window still lit",
            ],
            motions: [
                "sitting on ancient stone steps looking at falling petals, not catching them",
                "kneeling beside a small grave marker in a forest, hand resting on it gently",
                "walking very slowly through fog, the world reduced to ten feet in all directions",
            ],
            cameraLanguage: [
                "slow wide pull-back revealing the scale of the emptiness around the character",
                "long static shot—nature moving subtly, character perfectly still",
                "high angle, character small in a vast ruined landscape",
            ],
        },
        Centro: {
            scenarios: [
                "ferry between two worlds, both shores visible, the water perfectly calm",
                "crossroads in a spirit forest, paths going in four directions, none more obvious",
                "threshold of a magical door, one world bright, one unknown",
            ],
            motions: [
                "standing at the ferry railing looking at neither shore, just the water",
                "one hand on the door frame, weight not committed to entering or leaving",
                "crouching to examine something too small to name, expression unreadable",
            ],
            cameraLanguage: [
                "perfect symmetry, both worlds mirrored on either side of the character",
                "slow lateral dolly revealing one world replacing another",
                "shot framed through a doorway or arch, world split by the frame",
            ],
        },
    },

    ufotable: {
        PositivoAtivo: {
            scenarios: [
                "noble phantasm activation, reality fracturing at the edges with golden light",
                "rooftop above a city at night after a decisive victory, mana residue glowing",
                "ancient throne room bathed in the light of a triumphant bounded field",
            ],
            motions: [
                "weapon raised high, magic circles blooming open beneath the feet",
                "landing from height, crater forming, energy dissipating outward",
                "eyes opened after a surge of power, glow fading, breath leveling",
            ],
            cameraLanguage: [
                "sweeping 3D arc shot around a triumphant figure, sky enormous",
                "low hero angle with volumetric light rays emanating from behind",
                "high-speed tracking pull-back from insanely close to vast scale",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "moonlit Japanese shrine after battle, torii casting perfect shadows",
                "a servant and master in a quiet garden, the magical world momentarily at peace",
                "a castle's great library at dusk, last light through tall windows on old books",
            ],
            motions: [
                "sheathing a weapon slowly, eyes closing in quiet relief",
                "two figures sitting together, not speaking, magic residue fading from the air",
                "one hand raised to touch a floating magical artifact, expression peaceful",
            ],
            cameraLanguage: [
                "slow push-in on a composed expression in magical ambient light",
                "tight two-shot with extraordinary depth of field and particle glow",
                "high-angle establishing shot of a serene magical landscape at golden hour",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "ley line eruption cracking a city district, light and shadow in violent battle",
                "bounded field collapsing inward, reality peeling at the edges",
                "abandoned church, fog and dark flame, two forces about to collide",
            ],
            motions: [
                "arm extended calling forth a noble phantasm, the air warping around it",
                "sliding to a defensive stance, command seal blazing on the back of the hand",
                "back against a pillar, breath controlled, calculating before striking",
            ],
            cameraLanguage: [
                "camera spinning in an arc around the character as energy erupts outward",
                "Dutch tilt with volumetric dark light, character in sharp relief",
                "crash push-in at point of maximum tension, depth of field collapsing",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "ruined church interior after a battle, stained glass broken, moonlight on debris",
                "empty grail chamber, no winner, the chamber's light dying",
                "servant beginning to fade, outline softening, eyes still open",
            ],
            motions: [
                "kneeling with one hand on the ground, strength almost gone",
                "looking at vanishing hands as a spirit form dissolves into light",
                "standing at the edge of a ruined platform, looking down, not falling",
            ],
            cameraLanguage: [
                "slow pull-back from an intimate close-up to a vast empty space",
                "overhead looking straight down on a solitary figure in the ruins",
                "side profile in a shaft of moonlight, most of the frame in deep shadow",
            ],
        },
        Centro: {
            scenarios: [
                "Einzbern forest at twilight, neither day nor night, magic suspended in the air",
                "a bridge over a dark river, two servants stopped mid-crossing",
                "the moment before a command seal choice, the seal half-illuminated",
            ],
            motions: [
                "hands clasped, eyes closed, not yet decided, the moment held",
                "two figures on opposite ends of a bridge, neither moving first",
                "a single step arrested mid-air, everything around it paused",
            ],
            cameraLanguage: [
                "split diopter—near and far equally sharp, neither one dominant",
                "slow orbit around a perfectly still figure in a liminal space",
                "rack focus cycling between two equal planes, finding no answer",
            ],
        },
    },

    mappa: {
        PositivoAtivo: {
            scenarios: [
                "Tokyo rooftop at night, neon reflections soaking the wet concrete below",
                "underground boxing ring, red corner light, crowd on their feet",
                "Shibuya crossing cleared, character in the center, city exploding around them",
            ],
            motions: [
                "fist raised after a fight, sweat and exhilaration, crowd behind",
                "urban parkour—launching off a rail, city dropping away below",
                "slamming through a door into open air, back-lit by the city below",
            ],
            cameraLanguage: [
                "crash zoom in on a triumphant expression, bokeh of city lights",
                "low Dutch angle showing scale and momentum, world tilted with energy",
                "whip pan tracking movement at full speed through an urban frame",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "izakaya corner booth, warm amber light, two people after a hard day",
                "convenience store 2 AM, only customer, fluorescent warmth against blue night outside",
                "apartment rooftop at sunset, laundry on the line, city going quiet below",
            ],
            motions: [
                "leaning back with a can, looking at the city from a railing, at ease",
                "laughing at something small, elbows on a low table",
                "two people walking slowly home, hands nearly touching",
            ],
            cameraLanguage: [
                "intimate mid-shot with textured urban background softly lit",
                "side profile with soft warm light from inside cutting into blue exterior",
                "wide shot of the full human scene, city as backdrop not threat",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "domain expansion collapsing Shibuya, cursed energy splitting the air",
                "ruined city block under a blood-red sky, only one figure standing",
                "underground cage fight, fury and desperation, metal mesh catching the light",
            ],
            motions: [
                "Black Flash hit—time fractalized, fist at impact, world going white",
                "screaming with a domain expanding out of the body, arms thrown wide",
                "catching a falling wall fragment bare-handed, knees buckling under the load",
            ],
            cameraLanguage: [
                "impact freeze-frame: full stop, energy lines, extreme close-up",
                "extreme Dutch tilt with fast handheld energy, chaos barely contained",
                "cut to black mid-motion, held for a beat, then cut back",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "empty gym at 4 AM, single overhead light, punching bag still swinging",
                "back alley under an overpass in the rain, chain-link fence, one puddle of reflected orange light",
                "apartment with all lights off except a monitor glow, takeout box cold on the desk",
            ],
            motions: [
                "sitting on a locker room bench, head down, forearms on knees",
                "standing in rain under a failing umbrella, not moving for shelter",
                "leaning against a cold concrete wall, sliding slowly down to sit on the floor",
            ],
            cameraLanguage: [
                "tight close-up on hands hanging between knees, face barely visible",
                "low floor-level shot, character folded into themselves in a corner",
                "flat static mid shot, character inside harsh fluorescent box light",
            ],
        },
        Centro: {
            scenarios: [
                "train platform at midnight, character mid-decision, train visible in the distance",
                "Shibuya crossing 3 AM, all signals paused, alone in the center",
                "apartment half-packed with boxes, some put away, some still open",
            ],
            motions: [
                "phone in hand, unsent message on screen, thumb hovering",
                "one foot on the train, one still on the platform, doors about to close",
                "looking at two different jackets laid out, neither picked up",
            ],
            cameraLanguage: [
                "centered symmetrical shot, character the axis between two worlds",
                "slow push-in that doesn't commit to either side of the frame",
                "handheld subtle float, unresolved, searching",
            ],
        },
    },

    shaft: {
        PositivoAtivo: {
            scenarios: [
                "impossible architecture shattering into geometric fragments of brilliant color",
                "abstract kaleidoscopic space made of tilted text panels and color blocks in celebration",
                "a surreal cityscape where gravity has abandoned its usual direction, character at its apex",
            ],
            motions: [
                "head tilted at an impossible angle, breaking into a smile that breaks the composition",
                "arms outstretched, silhouette against a void of pure saturated color",
                "spinning in a mathematically impossible environment, each rotation revealing a new world",
            ],
            cameraLanguage: [
                "spiral zoom centered on the character, geometry unfolding around them",
                "extreme Dutch tilt inverting to extreme Dutch tilt the opposite direction mid-shot",
                "rapid cuts between static geometric frames, each one a different angle on the same moment",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "bookshelves stretching to infinite in warm amber light, impossible scale and stillness",
                "a white room with one impossibly beautiful window and nothing else",
                "a symbolic garden with no physics—flowers in the air, water flowing upward",
            ],
            motions: [
                "sitting in white space, one leg crossed, reading something only they can see",
                "a hand reaching toward an impossible light source from the left side of the frame only",
                "completely still, facing away, the environment arranged in perfect calm around them",
            ],
            cameraLanguage: [
                "extreme long shot—character a single glyph in an infinite warm space",
                "flat frontal shot with all depth removed, purely graphic",
                "slow drift sideways, the environment a continuous panel of abstract warmth",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "surreal corridor tilting toward a vanishing point that leads nowhere",
                "abstract shapes collapsing inward like a world folding onto itself",
                "a confrontation in a field of negative space—only figures and shadow, no environment",
            ],
            motions: [
                "the iconic head tilt—but performed at 90 degrees, eye locked directly at the viewer",
                "shadow peeling from the body and moving independently in a different direction",
                "two silhouettes at opposite ends of a tilting frame, both rigid, neither yielding",
            ],
            cameraLanguage: [
                "extreme Dutch at 45°, nothing horizontal in the frame",
                "quick hard cuts between uncomfortable static angles, rhythm building pressure",
                "smash to pure color, held, then hard cut to tight close-up",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "monochrome infinite hallway with a single detail—one lit window, one open door",
                "a void of flat grey with one impossible chair and one impossible lamp",
                "a room made of stacked books, all closed, all grey, going on forever",
            ],
            motions: [
                "sitting absolutely still, facing the camera, expression removed of all affect",
                "one single tear drawn as a perfect geometric line on a flat-drawn face",
                "standing in a void, arms at sides, the environment doing all the emotional work",
            ],
            cameraLanguage: [
                "perfectly locked-off frontal shot, zero camera movement, formally composed",
                "extreme close-up on the eye, the void reflected in it",
                "very slow mechanical push-in over a long duration, no arrival point",
            ],
        },
        Centro: {
            scenarios: [
                "an impossible staircase going both up and down with no difference between the two",
                "a mirrored room where the reflection shows a different moment than the one happening",
                "a corridor with identical doors on both sides, all the same, no way to distinguish",
            ],
            motions: [
                "hands folded in a lap, facing the camera, perfectly still, neither yes nor no",
                "reflection doing something slightly different from the original figure",
                "finger pointed at the camera, paused, never arriving",
            ],
            cameraLanguage: [
                "split frame—left half and right half doing completely different things simultaneously",
                "slow rotation of the whole frame, character staying upright as the world turns",
                "rack focus that never commits, cycling back and forth between two planes",
            ],
        },
    },

    trigger: {
        PositivoAtivo: {
            scenarios: [
                "giant mech cockpit at peak synchronization, spiral galaxy through the viewport",
                "neon dystopian city at 200 km/h, buildings streaking to color",
                "arena floor after a decisive victory, crowd exploding, lights on the winner",
            ],
            motions: [
                "dramatic pointing at the sky, cape exploding outward, impossible proportions",
                "mid-transformation sequence—half human, half something cosmic",
                "screaming a battle cry at maximum volume, the world bending around the sound",
            ],
            cameraLanguage: [
                "spiral zoom in to extreme close-up, energy lines in every direction",
                "impossible low angle, character against an infinitely winding galaxy",
                "smash cut to impact frame: full stop, white out, energy lines, then explode to wide",
            ],
        },
        PositivoCalmo: {
            scenarios: [
                "beach at an impossibly saturated sunset—sky doing things physics doesn't allow",
                "hilltop overlooking a glowing neon city, impossible color harmony above and below",
                "the inside of a Trigger promotional poster come to life—stylized and iconic",
            ],
            motions: [
                "leaning back on a hillside, arms behind the head, completely unguarded",
                "squinting at the horizon, expression the smug calm of someone who already won",
                "feet dangling over an enormous drop, at perfect peace with it",
            ],
            cameraLanguage: [
                "stylized wide shot with the character as a graphic element in a graphic world",
                "sweeping crane up from ground to reveal the full impossible landscape",
                "flat silhouette against a saturated gradient sky, strong graphic design energy",
            ],
        },
        NegativoAtivo: {
            scenarios: [
                "city under attack from spiral energy—buildings shearing, sky cracking",
                "final stand on a destroyed platform, the world falling around a single figure",
                "the inside of a collapsing mech cockpit, the pilot refusing to stop",
            ],
            motions: [
                "full-body forward charge, exaggerated smear frames, speed lines everywhere",
                "mid-air rotation before a devastating attack, body wound to maximum tension",
                "fist at point of impact, shockwave radiating outward, world splitting at the point",
            ],
            cameraLanguage: [
                "rotating dutch angle combined with crash zoom—pure kinetic chaos",
                "impact freeze frame: white flash, energy lines, held for exactly one breath",
                "extreme low angle from the ground, attack coming down at full scale",
            ],
        },
        NegativoCalmo: {
            scenarios: [
                "aftermath of a mech battle—one figure kneeling in a field of debris, sky clearing",
                "single character at the center of a destroyed arena, smoke rising, crowd gone",
                "rocky coast at dawn after something enormous ended the night before",
            ],
            motions: [
                "sitting cross-legged in wreckage, hands in the lap, eyes closed, at peace now",
                "one hand pressed to the chest, head tilted back, breathless but alive",
                "looking at a broken weapon held in both hands, expression soft with acceptance",
            ],
            cameraLanguage: [
                "slow wide crane revealing the full scale of the aftermath around a small still figure",
                "tight close-up on an expression of exhausted peace, debris soft in the background",
                "back shot, character facing the horizon, world behind them done",
            ],
        },
        Centro: {
            scenarios: [
                "crossroads between two impossible worlds—one spiral, one linear, both total",
                "the exact geometric center of a Trigger universe, equidistant from all forces",
                "a still point inside an ongoing spiral that hasn't resolved its direction yet",
            ],
            motions: [
                "standing arms out, weight on one foot, not yet committed to the next move",
                "eyes half-open looking at two equally impossible futures with equal calm",
                "one hand closed, one hand open—neither action chosen",
            ],
            cameraLanguage: [
                "rotating shot that never stops, the world cycling endlessly around the character",
                "symmetrical split showing two equal and opposite forces perfectly balanced",
                "pull back from extremely close to cosmic-wide, pausing at the exact center",
            ],
        },
    },
};

// ── Per-mood emotional nuance (palette, atmosphere, symbol) ───────────────────
type MoodNuance = { palettes: string[]; atmosphere: string[]; symbols: string[] };

const MOOD_NUANCE: Record<string, MoodNuance> = {
    Euforia:    { palettes: ["electric yellow and amber burst on deep shadow", "neon gold with luminous bloom and hot white specular"], atmosphere: ["time suspended at its fastest, most alive moment", "the world incandescent for exactly this instant"], symbols: ["fireworks mid-explosion filling sky", "shattered glass frozen in light"] },
    Celebracao: { palettes: ["vivid coral and warm gold with saturated celebration light", "festive rose and amber tones with sparkling particle bursts"], atmosphere: ["shared joy that multiplies when felt together — the electricity of belonging to a crowd that is all feeling the same thing", "the peak moment of collective euphoria, bodies close, voices loud, time suspended at its most alive"], symbols: ["crowd of friends silhouetted mid-jump against an explosive burst of fireworks, energy lines radiating outward — no food, no tables, only people and light", "festival concert crowd screaming together, protagonist lifted above them, confetti and light trails in every direction"] },
    Confianca:  { palettes: ["cool steel blue and lime on near-black", "monochrome with one sharp neon accent piercing through"], atmosphere: ["quiet authority that needs no announcement", "calm certainty before something inevitable"], symbols: ["city reflected in lenses", "geometric shadow patterns in perfect alignment"] },
    Energia:    { palettes: ["industrial orange and raw teal on black asphalt", "aggressive neon on gritty dark texture"], atmosphere: ["physics at the human limit", "every surface vibrating with kinetic potential"], symbols: ["crack lines from an impact point", "sweat frozen mid-air under harsh light"] },
    Amor:       { palettes: ["pink blush and ivory in soft morning diffusion", "warm terracotta and mauve with gentle lens flare"], atmosphere: ["time at the pace of a heartbeat", "tenderness that doesn't need words"], symbols: ["pressed flowers and a soft candle", "two cups of coffee steaming side by side"] },
    Paz:        { palettes: ["seafoam and pale sky blue on cream morning light", "dusty lavender and cloud white at golden hour"], atmosphere: ["the quiet before the world wakes up", "stillness chosen and complete"], symbols: ["a single feather drifting in still air", "light through leaves making shifting patterns"] },
    Reflexao:   { palettes: ["deep indigo and lavender with star-glow accents", "midnight navy with violet bloom of distant city lights"], atmosphere: ["a question without an answer yet", "memory and present blending at the edges"], symbols: ["candle reflected in rain-streaked glass", "stars mirrored in a still puddle"] },
    Tensao:     { palettes: ["sick green-yellow fluorescent over cold shadow", "desaturated near-monochrome with one red light source"], atmosphere: ["the dread of something unsaid and unavoidable", "every small sound carrying double meaning"], symbols: ["a phone screen flashing face-down", "a cracked mirror in a dim bathroom"] },
    Revolta:    { palettes: ["blood red and obsidian with harsh rim light", "sulfur yellow and char black with ember glow"], atmosphere: ["rage that has been held too long and finally broken", "destruction as the only language left"], symbols: ["shattered concrete with rebar exposed", "embers rising from a dying fire"] },
    Frustracao: { palettes: ["muddy amber and charcoal with harsh overhead source", "muted orange-gold with cold blue underlight"], atmosphere: ["friction between what should be and what is", "energy trapped with nowhere to go"], symbols: ["a dead end sign in the rain", "a clock face whose hands refuse to move"] },
    Melancolia: { palettes: ["muted steel blue and dusty lavender in fog-diffused light", "sepia warmth bleeding into cool evening blue"], atmosphere: ["nostalgia worn smooth by time—bittersweet not sharp", "the beauty of things passing, not yet gone"], symbols: ["a forgotten umbrella on a bench in rain", "a name carved in an old tree growing out of shape"] },
    Tristeza:   { palettes: ["deep slate and pewter on near-black", "low-contrast grey-blue wash with one dim warm source point"], atmosphere: ["grief that has settled in and is not leaving", "the absence of something that once filled the frame"], symbols: ["a wilted flower in a glass of water", "an empty chair at a set table"] },
    Vazio:      { palettes: ["concrete grey and washed-out white—no warmth anywhere", "flat desaturated teal and near-black with zero contrast"], atmosphere: ["the static between stations, signal gone", "not sadness—just the complete absence of everything"], symbols: ["a blank screen reflecting a face", "a room with everything in its place and no one in it"] },
    Ambivalente:{ palettes: ["two-tone split: warm amber one side, cool blue the other", "golden hour and overcast in the same frame, perfectly divided"], atmosphere: ["the suspended moment between two completely different futures", "the strange beauty of not knowing yet"], symbols: ["a coin mid-spin both faces visible", "a door half-open with different light on each side"] },
};

// ── Activation modifier ───────────────────────────────────────────────────────
function activationModifier(ativacao: number): string {
    if (ativacao >  0.6) return "HIGH KINETIC ENERGY: scene pulsing with motion. Use motion blur on peripherals, dynamic angles, violent environmental movement. Time feels compressed and fast.";
    if (ativacao >  0.2) return "MODERATE ENERGY: natural forward momentum. Environment moving (swaying lights, passing cars, wind). Character engaged and present.";
    if (ativacao > -0.2) return "BALANCED ENERGY: the scene breathes naturally. Small movements only—leaf falling, steam rising, cloth in the wind. Character composed and aware.";
    if (ativacao > -0.6) return "LOW GENTLE ENERGY: slow and contemplative. Long still moments. Minimal motion. Character absorbed inward.";
    return                      "NEAR-STATIC: almost motionless. Dust in a light beam. A held breath. The character barely moves—stillness is the subject.";
}

// ── Studio styles ─────────────────────────────────────────────────────────────
const STUDIO_STYLES: StudioStyle[] = [
    {
        id: "kyoani", name: "Kyoto Animation inspired (KyoAni)", company: "Kyoto Animation", logoKey: "kyoani",
        referenceAnimes: ["Violet Evergarden", "K-On!", "Hyouka", "A Silent Voice", "Clannad After Story"],
        visualLanguage: "soft diffused lighting, pastel palette, glossy expressive eyes, detailed micro-expressions, clean polished rendering, slice-of-life emotional realism",
        cinematography: "stable natural framing, intimate close-ups, focus on character acting over spectacle",
        motionStyle: "extremely fluid, subtle gestures—eye movement, breathing, hair sway—high frame consistency",
        renderingNotes: "meticulous anatomy and fabric detail, realistic lighting, rich everyday environments with depth and softness",
    },
    {
        id: "ghibli", name: "Studio Ghibli inspired", company: "Studio Ghibli", logoKey: "ghibli",
        referenceAnimes: ["Spirited Away", "Howl's Moving Castle", "Princess Mononoke", "The Wind Rises", "My Neighbor Totoro"],
        visualLanguage: "hand-painted watercolor backgrounds, organic textures, natural color harmony, deeply expressive but simple character designs, nostalgic and dreamlike",
        cinematography: "wide scenic shots, environmental storytelling, slow contemplative pacing, atmosphere and world immersion above all",
        motionStyle: "weighty and natural movement, grounded physics even in fantasy, calm and deliberate timing",
        renderingNotes: "visible brush strokes, traditional cel feel, strong connection between characters and living natural world",
    },
    {
        id: "ufotable", name: "Ufotable inspired", company: "ufotable", logoKey: "ufotable",
        referenceAnimes: ["Fate/stay night UBW", "Demon Slayer", "Kara no Kyoukai", "Tales of Zestiria the X"],
        visualLanguage: "cinematic lighting, high contrast, glowing highlights, heavy particle effects (embers smoke sparks), digital compositing with depth of field",
        cinematography: "dynamic camera movement, sweeping 3D-assisted angles, cinematic tracking shots comparable to live-action film",
        motionStyle: "smooth but impactful, dramatic anticipation and release, layered VFX timing precision",
        renderingNotes: "polished compositing, volumetric atmospheric lighting, strong depth layering between character and effect",
    },
    {
        id: "mappa", name: "Studio MAPPA inspired", company: "MAPPA", logoKey: "mappa",
        referenceAnimes: ["Jujutsu Kaisen", "Chainsaw Man", "Attack on Titan Final Season", "Vinland Saga S2"],
        visualLanguage: "cinematic contrast, gritty urban texture, expressive linework, intense facial emotion, grounded anatomy with dramatic impact",
        cinematography: "dynamic but controlled camera, strong silhouettes, action-first staging with moody atmospheric depth",
        motionStyle: "weighty impactful movement with sharp key poses, high-tension rhythm and readable choreography",
        renderingNotes: "rich shadow design, textured backgrounds, dramatic color separation, grounded realism without photorealism",
    },
    {
        id: "shaft", name: "Studio Shaft inspired", company: "Shaft", logoKey: "shaft",
        referenceAnimes: ["Bakemonogatari", "Puella Magi Madoka Magica", "March Comes in Like a Lion", "Sayonara Zetsubou Sensei"],
        visualLanguage: "avant-garde composition, bold color blocking, abstract or symbolic backgrounds, minimalist environments with strong graphic identity",
        cinematography: "extreme angles, head tilts, rapid hard cuts, unusual framing with heavy negative space",
        motionStyle: "limited animation used stylistically—focus on composition and graphic rhythm over fluid motion",
        renderingNotes: "surreal staging, symbolic imagery, experimental visual storytelling—form serves psychology not naturalism",
    },
    {
        id: "trigger", name: "Studio Trigger inspired", company: "Studio Trigger", logoKey: "trigger",
        referenceAnimes: ["Kill la Kill", "Promare", "Cyberpunk Edgerunners", "Gurren Lagann", "Little Witch Academia"],
        visualLanguage: "bold linework, maximum saturated color, exaggerated proportions, cartoony expressive design pushed to extremes",
        cinematography: "fast cuts, extreme zooms, dynamic impossible framing, high-energy visual storytelling at maximum volume",
        motionStyle: "hyper-kinetic, smear frames, exaggerated to the point of deformation—intentional chaos that is always readable",
        renderingNotes: "strong silhouettes, maximum contrast shapes, expressive deformation always preferred over anatomical realism",
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

        const scenario    = dna     ? this.random(dna.scenarios)      : "an evocative environment";
        const motion      = dna     ? this.random(dna.motions)        : "a considered emotional pose";
        const camera      = dna     ? this.random(dna.cameraLanguage) : "deliberate mid-shot";
        const palette     = nuance  ? this.random(nuance.palettes)    : "rich cinematic color grading";
        const atmosphere  = nuance  ? this.random(nuance.atmosphere)  : "charged with unspoken emotion";
        const symbol      = nuance  ? this.random(nuance.symbols)     : "one meaningful visual detail";

        const moodSpecificRules = moodKey === "Celebracao" ? `
━━━━━━━━━━
MOOD-SPECIFIC RULES — CELEBRACAO (SOCIAL CELEBRATION)
━━━━━━━━━━
This mood is about COLLECTIVE SOCIAL JOY as seen in iconic anime productions.
MANDATORY: The scene must depict a crowd, group of friends, or large social gathering in a peak celebratory moment — exactly like a climactic scene from a famous anime.
Inspiration: concert arena crowd erupting during a final performance (K-On!, Your Lie in April), school festival crowd going wild, group victory moment with characters lifted above a roaring crowd (Haikyuu!!), festival fireworks scene with silhouetted figures together (Any Given Ghibli Matsuri scene), idol stage finale with light sticks and thousands of fans (Love Live!, Oshi no Ko).
STRICTLY FORBIDDEN: dining tables, food on tables, banquet settings, restaurant scenes, picnic setups, or any arrangement of food items near characters. No meals. No eating. No table settings of any kind.
The energy source is PEOPLE and SHARED EMOTION, not food. Lights, confetti, fireworks, music stages, crowd movement, light sticks, and stadium energy are the only acceptable environmental elements.
` : "";

        return `
Create a breathtaking stylized 2D anime illustration in the style of ${studio.name}, capturing the emotional theme "${data.sentiment}".

NON-NEGOTIABLE VISUAL FIDELITY:
Stay 100% true to the studio's aesthetic DNA at all times. Every choice—environment, lighting, linework, color, motion—must feel like it authentically belongs in a production from ${studio.company}. Reference anime: ${refAnime}.

━━━━━━━━━━
STUDIO DNA
━━━━━━━━━━
Visual language: ${studio.visualLanguage}
Cinematography: ${studio.cinematography}
Motion style: ${studio.motionStyle}
Rendering: ${studio.renderingNotes}

━━━━━━━━━━
SCENE — THROUGH ${studio.company.toUpperCase()}'S LENS
━━━━━━━━━━
Environment (render in authentic ${studio.company} style):
${scenario}

Character posture / motion (grounded in ${studio.company}'s animation vocabulary):
${motion}

Camera language (strictly ${studio.company} cinematography):
${camera}

━━━━━━━━━━
EMOTIONAL DIRECTION — "${data.sentiment.toUpperCase()}"
━━━━━━━━━━
Color palette: ${palette}
Atmospheric quality: ${atmosphere}
Symbolic visual element (integrate organically): ${symbol}
Energy level: ${actMod}
${moodSpecificRules}
━━━━━━━━━━
CHARACTER
━━━━━━━━━━
Face reference: ${data.faceReferencePath ?? "not provided"}
- If a face reference is provided, translate their identity into ${studio.company}'s character design language. Do not retain photorealism.
- Single young adult character.

━━━━━━━━━━
OUTPUT
━━━━━━━━━━
- Aspect Ratio: 9:16 (Portrait)
- Format: Stylized 2D Anime Illustration. NEVER photorealistic.
- The result must be instantly recognizable as a ${studio.company} production.
- DO NOT include readable text or floating typography (incidental environmental text, e.g., distant signs, is acceptable).
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