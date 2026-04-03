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
const EMOTION_METADATA: Record<string, {
    en: string;
    description: string;
}> = {
    EuforiaAtiva: {
        en: "euphoric excitement",
        description: "intense joy, freedom, high energy, explosive emotional expression"
    },
    ConfiancaDominante: {
        en: "dominant confidence",
        description: "strong presence, control, self-assurance, calm power"
    },
    RockEletrizante: {
        en: "adrenaline rush",
        description: "raw energy, chaos, speed, loud emotional intensity"
    },
    TensaoCriativa: {
        en: "creative tension",
        description: "inner pressure mixed with focus and artistic energy"
    },

    AmorCalmo: {
        en: "calm love",
        description: "soft affection, emotional safety, warmth and intimacy"
    },
    ConexaoAfetiva: {
        en: "emotional connection",
        description: "deep bonding, closeness, shared emotional presence"
    },
    NostalgiaFeliz: {
        en: "happy nostalgia",
        description: "warm memories with a subtle bittersweet tone"
    },
    Serenidade: {
        en: "serenity",
        description: "peaceful stillness, emotional balance, quiet calm"
    },
    PazInterior: {
        en: "inner peace",
        description: "deep tranquility, absence of conflict, grounded calm"
    },
    Contemplacao: {
        en: "contemplation",
        description: "reflective state, observing quietly, thoughtful stillness"
    },

    TensaoDramatica: {
        en: "dramatic tension",
        description: "intense emotional pressure, suspense, inner conflict"
    },
    Frustracao: {
        en: "frustration",
        description: "blocked intention, irritation, restrained emotional tension"
    },
    IrritacaoAtiva: {
        en: "active irritation",
        description: "agitated annoyance, restless discomfort"
    },
    RaivaExplosiva: {
        en: "explosive anger",
        description: "uncontrolled rage, aggressive emotional outburst"
    },

    NostalgiaProfunda: {
        en: "deep nostalgia",
        description: "heavy memories, longing, emotional weight"
    },
    Desanimo: {
        en: "discouragement",
        description: "low energy sadness, lack of motivation, emotional fatigue"
    },

    VulnerabilidadeEmocional: {
        en: "emotional vulnerability",
        description: "openness, fragility, exposed emotional state"
    },
    Ambivalencia: {
        en: "emotional ambivalence",
        description: "conflicting feelings, mixed emotions, uncertainty"
    },
    Estupor: {
        en: "emotional numbness",
        description: "detachment, shock, lack of emotional reaction"
    },
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

export type CreativePromptBlocks = {
    shotComposition: string;
    cameraLanguage: string;
    gazeBehavior: string;
    pose: string;
    action: string;
    worldFlavor: string;
    environment: string;
};

const STUDIO_STYLES: StudioStyle[] = [
    {
        id: "kyoani",
        name: "Kyoto Animation inspired (KyoAni)",
        company: "Kyoto Animation",
        logoKey: "kyoani",
        referenceAnimes: ["Violet Evergarden", "K-On!", "Hyouka"],
        visualLanguage: `
soft diffused lighting, pastel color palette, glossy expressive eyes,
highly detailed facial micro-expressions, clean and polished character rendering,
slice-of-life realism with emotional subtlety
    `.trim(),
        cinematography: `
stable framing, natural camera behavior, intimate close-ups,
focus on character acting rather than spectacle
    `.trim(),
        motionStyle: `
extremely fluid animation, subtle gestures (eye movement, breathing, hair sway),
high frame consistency and realism
    `.trim(),
        renderingNotes: `
meticulous detail in anatomy and fabric, realistic lighting interaction,
rich everyday environments with depth and softness
    `.trim(),
    },
    {
        id: "ghibli",
        name: "Studio Ghibli inspired",
        company: "Studio Ghibli",
        logoKey: "ghibli",
        referenceAnimes: ["Spirited Away", "Howl's Moving Castle", "My Neighbor Totoro"],
        visualLanguage: `
hand-painted watercolor backgrounds, organic textures, natural color harmony,
simple but deeply expressive character designs, nostalgic and dreamlike tone
    `.trim(),
        cinematography: `
wide scenic shots, environmental storytelling, slow contemplative pacing,
focus on atmosphere and world immersion
    `.trim(),
        motionStyle: `
weighty and natural movement, grounded physics even in fantasy,
calm and deliberate animation timing
    `.trim(),
        renderingNotes: `
visible brush strokes, traditional cel animation feel,
strong connection between characters and nature
    `.trim(),
    },
    {
        id: "ufotable",
        name: "Ufotable inspired",
        company: "ufotable",
        logoKey: "ufotable",
        referenceAnimes: ["Fate/stay night UBW", "Demon Slayer", "Kara no Kyoukai"],
        visualLanguage: `
cinematic lighting, high contrast visuals, glowing highlights,
heavy use of particle effects (embers, smoke, sparks),
digital compositing with depth-of-field
    `.trim(),
        cinematography: `
dynamic camera movement, sweeping angles, 3D-assisted tracking shots,
cinematic framing similar to live-action films
    `.trim(),
        motionStyle: `
smooth but impactful animation, dramatic anticipation and release,
action sequences with layered effects and timing precision
    `.trim(),
        renderingNotes: `
polished compositing between character and VFX,
volumetric lighting, strong atmosphere and depth layering
    `.trim(),
    },
    {
        id: "mappa",
        name: "Studio MAPPA inspired",
        company: "MAPPA",
        logoKey: "mappa",
        referenceAnimes: ["Jujutsu Kaisen", "Chainsaw Man", "Attack on Titan Final Season"],
        visualLanguage: `
cinematic contrast, gritty urban texture, expressive linework,
intense facial emotion, grounded anatomy with dramatic impact
    `.trim(),
        cinematography: `
dynamic but controlled camera language, strong silhouettes,
action-first staging with moody atmospheric depth
    `.trim(),
        motionStyle: `
weighty impactful movement, sharp key poses,
high-tension action rhythm with readable choreography
    `.trim(),
        renderingNotes: `
rich shadow design, textured backgrounds, dramatic color separation,
grounded realism in anime form without photorealism
    `.trim(),
    },
    {
        id: "shaft",
        name: "Studio Shaft inspired",
        company: "Shaft",
        logoKey: "shaft",
        referenceAnimes: ["Bakemonogatari", "Puella Magi Madoka Magica", "March Comes in Like a Lion"],
        visualLanguage: `
avant-garde composition, bold color blocking, abstract backgrounds,
minimalist or symbolic environments, strong graphic identity
    `.trim(),
        cinematography: `
extreme camera angles, head tilts, rapid cuts,
unusual framing with heavy negative space and visual rhythm
    `.trim(),
        motionStyle: `
limited animation used stylistically,
focus on composition and editing over fluid motion
    `.trim(),
        renderingNotes: `
surreal staging, symbolic imagery, typography-like visual pacing (without readable text),
experimental visual storytelling
    `.trim(),
    },
    {
        id: "trigger",
        name: "Studio Trigger inspired",
        company: "Studio Trigger",
        logoKey: "trigger",
        referenceAnimes: ["Kill la Kill", "Little Witch Academia", "Cyberpunk Edgerunners"],
        visualLanguage: `
bold linework, saturated vibrant colors, exaggerated proportions,
cartoony and expressive character design
    `.trim(),
        cinematography: `
fast cuts, extreme zooms, dynamic framing,
high-energy visual storytelling
    `.trim(),
        motionStyle: `
hyper-kinetic animation, smear frames, exaggerated movement,
intentionally chaotic but readable action
    `.trim(),
        renderingNotes: `
strong silhouettes, high contrast shapes,
expressive deformation over realism
    `.trim(),
    }
];

@Injectable()
export class ImagePromptService {

    private shouldAllowFuturisticElements(studio: StudioStyle, referenceAnime: string): boolean {
        const source = [
            studio.name,
            referenceAnime,
            studio.referenceAnimes.join(" "),
            studio.visualLanguage,
            studio.cinematography,
            studio.motionStyle,
            studio.renderingNotes,
        ].join(" ").toLowerCase();

        const futuristicKeywords = [
            "cyberpunk",
            "sci-fi",
            "scifi",
            "futur",
            "neon",
            "hologram",
            "android",
            "robot",
            "mecha",
            "dystopian",
            "high-tech",
            "megacity",
            "space",
        ];

        return futuristicKeywords.some((keyword) => source.includes(keyword));
    }

    private stripFuturisticTerms(value: string): string {
        return value
            .replace(/\b(cyberpunk|futuristic|futurist|sci[- ]?fi|mecha|hologram|android|robot(?:ic)?|dystopian|high-tech|spaceport|spaceship|megacity|neon)\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    private removeFuturisticHints(blocks: CreativePromptBlocks): CreativePromptBlocks {
        const fallback: CreativePromptBlocks = {
            shotComposition: "wide candid composition with clear environment depth",
            cameraLanguage: "observational cinematic framing with natural movement",
            gazeBehavior: "gaze directed to surroundings, never to camera",
            pose: "natural dynamic pose with grounded body language",
            action: "everyday grounded action coherent with emotional tone",
            worldFlavor: "grounded anime world inspired by real urban and natural spaces",
            environment: "non-futuristic setting with believable architecture and atmosphere",
        };

        const cleaned = {
            shotComposition: this.stripFuturisticTerms(blocks.shotComposition),
            cameraLanguage: this.stripFuturisticTerms(blocks.cameraLanguage),
            gazeBehavior: this.stripFuturisticTerms(blocks.gazeBehavior),
            pose: this.stripFuturisticTerms(blocks.pose),
            action: this.stripFuturisticTerms(blocks.action),
            worldFlavor: this.stripFuturisticTerms(blocks.worldFlavor),
            environment: this.stripFuturisticTerms(blocks.environment),
        };

        return {
            shotComposition: cleaned.shotComposition || fallback.shotComposition,
            cameraLanguage: cleaned.cameraLanguage || fallback.cameraLanguage,
            gazeBehavior: cleaned.gazeBehavior || fallback.gazeBehavior,
            pose: cleaned.pose || fallback.pose,
            action: cleaned.action || fallback.action,
            worldFlavor: cleaned.worldFlavor || fallback.worldFlavor,
            environment: cleaned.environment || fallback.environment,
        };
    }

    build(data: HybridPromptInput, creativeBlocks?: Partial<CreativePromptBlocks>) {
        const seed = this.getCreativeSeed(data);
        const rawBlocks: CreativePromptBlocks = {
            shotComposition: creativeBlocks?.shotComposition?.trim() || seed.shotComposition,
            cameraLanguage: creativeBlocks?.cameraLanguage?.trim() || seed.cameraLanguage,
            gazeBehavior: creativeBlocks?.gazeBehavior?.trim() || seed.gazeBehavior,
            pose: creativeBlocks?.pose?.trim() || seed.pose,
            action: creativeBlocks?.action?.trim() || seed.action,
            worldFlavor: creativeBlocks?.worldFlavor?.trim() || seed.worldFlavor,
            environment: creativeBlocks?.environment?.trim() || seed.environment,
        };
        const studio = this.getStudioStyle(data.studioId);
        const referenceAnime = this.getRandomReferenceAnime(studio);
        const allowFuturisticElements = this.shouldAllowFuturisticElements(studio, referenceAnime);
        const blocks = allowFuturisticElements ? rawBlocks : this.removeFuturisticHints(rawBlocks);

        return `
Create a stylized 2D anime illustration in the style of ${studio.name}, representing the emotional theme "${data.sentiment}".
━━━━━━━━━━
STUDIO DIRECTION
━━━━━━━━━━
PRIMARY STYLE CONSTRAINT (ABSOLUTE PRIORITY):
The entire image MUST strictly follow ${studio.name} identity. If any instruction conflicts, studio identity wins.

Studio DNA:
- Visual language: ${studio.visualLanguage}
- Cinematography: ${studio.cinematography}
- Motion style: ${studio.motionStyle}
- Rendering notes: ${studio.renderingNotes}
- Reference anime: ${referenceAnime}

Do NOT mix styles.
Do NOT drift into generic anime or semi-realistic look.

━━━━━━━━━━
STYLE & MEDIUM (STRICT)
━━━━━━━━━━
- Stylized 2D anime illustration only (NOT a photo)
- Visible linework, anime/cel shading, painterly finish
- Medium detail (no ultra-detailed or hyper-sharp rendering)
- Soft edges over crisp realism
- Hand-crafted anime film aesthetic

DO NOT:
- Use photorealism, semi-realism, or 3D/CGI look
- Simulate DSLR, film grain, or real camera artifacts
- Apply real skin texture or photographic lighting

If the result looks realistic, force it back into anime illustration style.

${this.buildStyleReferences(studio, referenceAnime)}

━━━━━━━━━━
FUTURISTIC ELEMENT POLICY
━━━━━━━━━━
${allowFuturisticElements
                ? `- Futuristic elements are allowed only when coherent with ${referenceAnime} and ${studio.name}.
- Keep them secondary to character emotion and studio identity.
- Avoid generic cyberpunk cliches unless explicitly justified by scene context.`
                : `- Do NOT add futuristic elements.
- Forbidden: neon-cyberpunk motifs, holograms, mecha, androids, sci-fi interfaces, dystopian megacity tropes.
- Keep environment grounded (real-world inspired urban, nature, shrine, school, home, street, cafe, rooftop).`}

━━━━━━━━━━
SCENE & COMPOSITION
━━━━━━━━━━
- Shot composition: ${blocks.shotComposition}
- Camera language: ${blocks.cameraLanguage}
- Gaze behavior: ${blocks.gazeBehavior}
- Pose: ${blocks.pose}
- Action: ${blocks.action}
- World flavor: ${blocks.worldFlavor}
- Environment: ${blocks.environment}

━━━━━━━━━━
CHARACTER (HIGH PRIORITY)
━━━━━━━━━━
- Single young adult character
- Maintain strong resemblance to face reference
- Adapt identity into anime style (no realism carryover)

Face reference:
${data.faceReferencePath ?? "not provided"}

Rules:
- Preserve face structure, eyes, hairline, and proportions
- Do NOT copy photographic texture or lighting
- Identity must remain recognizable in anime form
- Outfit must read like a story protagonist: iconic silhouette, distinctive layers, and memorable hero-style design

━━━━━━━━━━
FRAMING RULES (CRITICAL)
━━━━━━━━━━
- Character must NOT look at the camera
- No direct eye contact
- Scene must feel candid, not posed
- Prefer:
  - side view
  - back view
  - over-the-shoulder
- Camera observes the moment, not interacts with subject
- Keep scene candid and natural, never editorial or fashion-like.

━━━━━━━━━━
STYLE ENFORCEMENT (HARD CONSTRAINTS)
━━━━━━━━━━
- Must read immediately as anime illustration
- No photorealism under any circumstance
- No live-action cinematic look
- No 3D rendering

━━━━━━━━━━
INTEGRITY CONSTRAINTS
━━━━━━━━━━
- Exactly one character
- One face only (no duplication)
- Correct anatomy (2 arms, 2 hands, 5 fingers)
- No extra limbs or distorted body parts
- No duplicated objects or mirrored props
- Physical interaction must be coherent

If uncertain, simplify composition.

━━━━━━━━━━
AVOID
━━━━━━━━━━
- photorealism, CGI, hyper-detail, 4K sharpness
- blurry faces, distortion, extra limbs
- text, watermark
- fantasy clichés (dragons, castles, armor, etc.)
- duplicated props or broken geometry
${allowFuturisticElements ? "- avoid generic neon/cyber clutter disconnected from selected reference" : "- any futuristic visual element"}

━━━━━━━━━━
FINAL INTENT
━━━━━━━━━━
Create a cinematic anime scene where studio identity is unmistakable and dominant.

━━━━━━━━━━
OUTPUT DIMENSIONS (MANDATORY)
━━━━━━━━━━
- Image must be 768 pixels wide × 1344 pixels tall
- Portrait orientation (9:16 ratio)
- Full-body or generous upper-body framing to fill the vertical canvas

Final check:
The result MUST look like an anime illustration, NEVER a real photo.
`;
    }

    getCreativeSeed(data: HybridPromptInput): CreativePromptBlocks {
        const intensidade = this.getIntensity(data.coreAxes.quadrante);

        return {
            shotComposition: this.getShotComposition(intensidade),
            cameraLanguage: this.getCameraLanguage(data.sentiment, intensidade),
            gazeBehavior: this.getGazeByIntensity(intensidade),
            pose: this.getPose(data.sentiment, intensidade),
            action: this.getAction(data.sentiment, intensidade),
            worldFlavor: this.getWorldFlavor(data.sentiment, intensidade),
            environment: this.getUniverse(data.sentiment, intensidade),
        };
    }


    // ---------------- INTENSIDADE ----------------
    private getIntensity(quadrante: string) {
        switch (quadrante) {
            case "PositivoAtivo":
                return "energetic";     // positivo + alta ativação
            case "PositivoCalmo":
                return "positive";      // positivo + baixa ativação
            case "NegativoAtivo":
                return "melancholic";  // negativo + alta ativação (tensão)
            case "NegativoCalmo":
                return "calm";         // negativo + baixa ativação
            default:
                return "balanced";
        }
    }
    private getGazeByIntensity(intensity: string) {
        const map: Record<string, string[]> = {
            euphoric: [
                "looking at friends around, not the camera",
                "gaze moving dynamically through the environment",
                "focused on the moment, ignoring the camera"
            ],
            energetic: [
                "eyes scanning surroundings quickly",
                "focused forward with intensity",
                "looking ahead with determination"
            ],
            positive: [
                "soft gaze into the distance",
                "looking at the environment with a light smile",
                "casual side glance"
            ],
            calm: [
                "eyes gently lowered",
                "looking at small details nearby",
                "soft unfocused gaze"
            ],
            melancholic: [
                "looking down in introspection",
                "gaze lost far away",
                "avoiding eye contact completely"
            ],
            balanced: [
                "natural gaze, not directed at camera",
                "subtle side glance",
                "looking around casually"
            ]
        };

        return this.random(map[intensity] || map["balanced"]);
    }
    private getShotComposition(intensity: string) {
        const map: Record<string, string[]> = {
            euphoric: [
                "wide dynamic shot with character interacting with environment, not facing camera",
                "low-angle moving shot, character looking away while in motion",
                "tracking perspective from behind, following the character",
                "very wide rooftop long shot with the character seen from far distance above the city",
                "bird-eye diagonal shot with tiny character crossing a luminous sky bridge",
                "lateral tracking shot through foreground lanterns and cables",
                "deep wide frame with layered crowds and the character crossing mid-ground"
            ],
            energetic: [
                "side-angle action shot with motion blur, no eye contact with camera",
                "over-the-shoulder shot focused on what the character sees",
                "mid-action frame, character looking forward, not at viewer",
                "long shot from a nearby building, character moving on a rooftop walkway",
                "compressed telephoto shot with crowd parallax and kinetic depth",
                "low tracking shot with foreground obstacles passing quickly",
                "high catwalk angle framing character between steel and glowing structures"
            ],
            positive: [
                "natural eye-level shot, character slightly turned away",
                "3/4 angle framing with soft gaze into the environment",
                "casual candid shot, not posed",
                "wide balcony framing with city depth and character occupying a small portion of frame",
                "quiet long lens shot through branches and shrine ribbons",
                "gentle dolly-like perspective with character crossing a moonlit walkway",
                "soft wide frame with generous negative space and lived-in details"
            ],
            calm: [
                "static wide shot with lots of negative space",
                "back view of character observing environment",
                "side profile with soft lighting, no camera awareness",
                "distant rooftop silhouette at dawn with quiet skyline depth",
                "locked-off corridor frame with layered foreground curtains",
                "very wide contemplative frame with tiny character near reflective water",
                "elevated still shot over temple stairs with drifting particles"
            ],
            melancholic: [
                "back-facing character looking out a window",
                "side profile with gaze downward, avoiding camera",
                "framed through window or objects, indirect view",
                "long telephoto shot from street level toward a lonely rooftop figure",
                "obstructed frame through rain-soaked glass and signage",
                "distant static shot where character is reduced by architecture scale",
                "off-axis frame with horizon slightly tilted for emotional instability"
            ],
            balanced: [
                "cinematic medium shot, slightly off-center framing",
                "natural composition, character not aware of camera",
                "environment-first framing with character integrated",
                "wide establishing shot with character seen from afar on a high building",
                "mixed-depth shot with foreground texture, mid-ground action, background atmosphere",
                "observational side-angle frame with candid street-like rhythm",
                "bridge-level wide frame connecting two realms with character in transition"
            ]
        };

        return this.random(map[intensity] || map["balanced"]);
    }

    private getCameraLanguage(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentCamera: Record<string, string[]> = {
            EuforiaAtiva: [
                "handheld-like energy with slight intentional instability",
                "fast observational tracking from behind",
                "wide lens with kinetic foreground passes"
            ],
            TensaoCriativa: [
                "long lens compression to increase inner pressure",
                "partial occlusion by frames, cables, and architectural edges",
                "slow creeping perspective that feels investigative"
            ],
            TensaoDramatica: [
                "angled framing with constrained headroom",
                "distance-first composition to stress isolation",
                "telephoto framing with heavy background pressure"
            ],
            Ambivalencia: [
                "split framing through mirrors, columns, or doorways",
                "uncertain axis with subtle perspective drift",
                "two-path composition emphasizing indecision"
            ],
            Estupor: [
                "static distant framing with minimal camera energy",
                "flattened depth to suggest emotional numbness",
                "cold objective viewpoint with no heroic emphasis"
            ]
        };

        const matched = this.findByNormalizedKey(sentimentCamera, key);
        if (matched) return this.random(matched);

        const intensityCamera: Record<string, string[]> = {
            euphoric: [
                "dynamic wide-lens movement with observational urgency",
                "energetic tracking from side and behind",
                "kinetic framing with layered foreground occlusion"
            ],
            energetic: [
                "semi-handheld cinematic movement",
                "compressed action framing with strong depth cues",
                "diagonal motion lines guiding the eye"
            ],
            positive: [
                "gentle stabilized movement with candid framing",
                "eye-level observational lensing",
                "soft off-center composition with breathable space"
            ],
            calm: [
                "locked-off long take feeling",
                "minimal camera intervention",
                "quiet framing with broad negative space"
            ],
            melancholic: [
                "distant telephoto isolation",
                "obstructed view through environmental layers",
                "slow restrained camera rhythm"
            ],
            balanced: [
                "naturalistic cinematic framing",
                "hybrid wide-to-medium observational lens language",
                "environment-led composition with candid subject placement"
            ]
        };

        return this.random(intensityCamera[intensity] || intensityCamera.balanced);
    }

    getAvailableStudios(): StudioStyleOption[] {
        return STUDIO_STYLES.map((studio) => ({
            id: studio.id,
            name: studio.name,
            company: studio.company,
            logoKey: studio.logoKey,
            referenceAnimes: studio.referenceAnimes,
            visualLanguage: studio.visualLanguage,
            cinematography: studio.cinematography,
            motionStyle: studio.motionStyle,
            renderingNotes: studio.renderingNotes,
        }));
    }


    private getStudioStyle(studioId?: string): StudioStyle {
        const targetId = studioId ? studioId.trim().toLowerCase() : "trigger";
        const selected = STUDIO_STYLES.find((studio) => studio.id === targetId);

        if (selected) return selected;

        return STUDIO_STYLES.find((studio) => studio.id === "trigger")!;
    }
    private getPose(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentPoses: Record<string, string[]> = {
            EuforiaAtiva: [
                "mid-step running transition with lifted shoulder and uneven balance",
                "half-turn candid posture caught between laugh and movement",
                "dynamic 3/4 body posture with natural arm swing"
            ],
            ConfiancaDominante: [
                "upright grounded stance with subtle weight on one leg, gaze past viewer",
                "calm dominant walk cycle captured in-between steps",
                "resting posture against architecture with composed body control"
            ],
            RockEletrizante: [
                "torso twist during acceleration with expressive hand tension",
                "low-angle motion posture with fabric reacting to speed",
                "candid stride interruption with kinetic body momentum"
            ],
            TensaoCriativa: [
                "slightly hunched thinking pose with active hands and focused eyes",
                "seated forward-lean pose with elbows on knees and concentrated expression"
            ],
            AmorCalmo: [
                "soft relaxed posture with gentle head tilt and warm off-camera gaze",
                "side-facing 3/4 pose with subtle smile and peaceful shoulders"
            ],
            ConexaoAfetiva: [
                "open body language with inviting shoulders and kind expression",
                "natural standing pose with relaxed arms and emotionally available gaze"
            ],
            NostalgiaFeliz: [
                "still reflective pose with slight smile and eyes looking into distance",
                "seated window-side posture with soft shoulders and nostalgic gaze"
            ],
            Serenidade: [
                "balanced neutral pose with relaxed spine and calm breathing",
                "minimal movement portrait pose with gentle gaze and loose shoulders"
            ],
            PazInterior: [
                "meditative straight posture with soft hands and closed or half-closed eyes",
                "centered seated pose with serene face and grounded shoulders"
            ],
            Contemplacao: [
                "side-profile contemplative pose looking at horizon",
                "quiet standing pose with chin slightly raised and thoughtful eyes"
            ],
            TensaoDramatica: [
                "alert posture with tense neck and guarded shoulders",
                "mid-step pause with defensive body compression",
                "abrupt stop posture as if reacting to off-frame event"
            ],
            Frustracao: [
                "closed posture with crossed arms and tightened jaw",
                "seated pose with elbows on thighs and visible irritation"
            ],
            IrritacaoAtiva: [
                "restless stance with uneven weight distribution and sharp gestures",
                "half-turned reactive pose with tense jaw and narrowed eyes"
            ],
            RaivaExplosiva: [
                "forward confrontational stance with clenched fists and intense stare",
                "wide-leg aggressive pose with elevated shoulders and explosive energy"
            ],
            NostalgiaProfunda: [
                "curled seated posture with lowered shoulders and distant gaze",
                "static side pose with heavy expression and subtle inward body tension"
            ],
            Desanimo: [
                "slouched posture with lowered head and drained body language",
                "slow-standing pose with rounded shoulders and tired eyes"
            ],
            VulnerabilidadeEmocional: [
                "fragile seated pose hugging knees or holding arms gently",
                "soft defensive posture with slightly collapsed shoulders and watery eyes"
            ],
            Ambivalencia: [
                "hesitant half-step with torso pulled in opposite directions",
                "conflicted posture with interrupted gesture and uncertain weight shift",
                "paused transition stance between leaving and staying"
            ],
            Estupor: [
                "frozen neutral posture with minimal gesture and blank stare",
                "still front-facing pose with detached expression and low muscle tension"
            ],

        };

        const matchedPoses = this.findByNormalizedKey(sentimentPoses, key);
        if (matchedPoses) {
            return this.random(matchedPoses);
        }

        const intensityPoses: Record<string, string[]> = {
            euphoric: [
                "expressive wide stance with open arms and bright gaze",
                "high-energy body angle with visible momentum"
            ],
            positive: [
                "confident relaxed posture with gaze drifting through the environment",
                "gentle 3/4 pose with subtle smile and open shoulders"
            ],
            energetic: [
                "dynamic movement-ready pose with torso twist",
                "active stance with forward weight and sharp focus"
            ],
            melancholic: [
                "quiet downward gaze with inward shoulders",
                "seated reflective pose with reduced motion"
            ],
            calm: [
                "stable centered pose with smooth breathing",
                "soft portrait posture with minimal tension"
            ],
            balanced: [
                "natural in-between movement pose with readable hands",
                "slightly angled neutral stance captured candidly",
                "transitional posture during everyday action"
            ],
        };

        return this.random(intensityPoses[intensity] || intensityPoses["balanced"]);
    }

    private normalizeSentiment(sentiment?: string) {
        return sentiment
            ?.trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[\s_-]+/g, "") ?? "";
    }
    private getAction(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentActions: Record<string, string[]> = {
            euforiaativa: [
                "laughing out loud on a rooftop at sunset",
                "dancing through a vibrant avenue with headphones",
                "laughing while running across city lights",
                "spinning under confetti-like street lights with open arms",
                "running up metro stairs with unstoppable excitement",
                "toasting with friends at a street bar table",
                "waving from a moving night bus window with pure joy",
                "walking across a rooftop helipad while the camera observes from far away",
                "jumping across narrow bridge segments in a floating district",
                "threading through lantern crowds while laughing mid-motion"
            ],
            confiancadominante: [
                "walking with steady posture through downtown",
                "standing with confident posture in a busy avenue",
                "standing on a balcony with assertive calm",
                "crossing a busy intersection with focused determination",
                "reviewing plans on a phone with calm authority",
                "ordering a drink with composed side gaze",
                "lighting a cigarette calmly while watching the street",
                "standing still on top of a high-rise while wind moves clothing"
            ],
            rockeletrizante: [
                "jumping with explosive body rhythm in the street",
                "skating fast through vibrant streets",
                "running through a crowded avenue with dynamic energy",
                "sprinting down an urban staircase with fierce momentum",
                "moving through a windy overpass with high kinetic force",
                "drinking water quickly then rushing back into the night",
                "laughing breathlessly after a fast sprint",
                "sliding down a steel ramp in a cursed transit zone",
                "dodging through market stalls in a thunder-lit district"
            ],
            tensaocriativa: [
                "writing intense notes in a small room",
                "arranging photos and papers with focused urgency",
                "pacing with restrained but rising tension",
                "rewriting pages on a desk with sleepless focus",
                "pinning ideas on a wall in a restless flow",
                "chain-smoking while revising a notebook",
                "drinking cold coffee while obsessively editing details",
                "tracing runes on walls while revising plans repeatedly",
                "sorting talismans on a desk then abruptly rearranging everything"
            ],
            amorcalmo: [
                "sharing a quiet drink in a cozy place",
                "walking side by side under warm night lights",
                "holding hands while talking softly",
                "resting foreheads together in a quiet corner",
                "watching rain together from a warm window seat",
                "cooking together in a small kitchen",
                "sharing one cigarette in silence with affectionate smiles"
            ],
            conexaoafetiva: [
                "chatting closely with a friend in a cafe",
                "smiling while exchanging headphones with someone",
                "toasting gently while exchanging natural side glances",
                "sharing an umbrella while laughing softly",
                "welcoming a friend with a heartfelt hug",
                "passing a lighter to a friend at a sidewalk table",
                "clinking glasses while talking about life"
            ],
            nostalgiafeliz: [
                "holding an old photo while smiling softly",
                "watching old memories on a phone by the window",
                "watching city lights with a warm drink in hand",
                "revisiting a childhood street with gentle joy",
                "opening a memory box and smiling through tears",
                "drinking at an old neighborhood bar with a nostalgic grin",
                "smoking slowly while rereading old messages",
                "watching an old soccer field from a distant rooftop viewpoint"
            ],
            serenidade: [
                "sipping tea by a calm window",
                "reading quietly in a bright cafe corner",
                "walking slowly in a peaceful park",
                "watering plants in soft morning light",
                "stretching quietly at sunrise on a balcony",
                "making breakfast in calm silence",
                "resting with a light drink on a quiet terrace"
            ],
            pazinterior: [
                "meditating in a minimalist room",
                "journaling in silence with soft morning light",
                "resting with eyes closed in complete quiet",
                "doing slow breathing beside a sunlit curtain",
                "folding blankets calmly in a quiet apartment",
                "washing dishes mindfully in a quiet kitchen",
                "drinking warm tea while listening to rain"
            ],
            contemplacao: [
                "staring at the horizon in deep thought",
                "sitting by the window reflecting in silence",
                "observing rain patterns on the glass",
                "standing on a bridge studying river reflections",
                "watching early fog drift across rooftops",
                "smoking alone at dawn with distant gaze",
                "turning a glass slowly while thinking deeply",
                "leaning on a rooftop rail from far distance in a quiet dawn city"
            ],
            tensaodramatica: [
                "walking quickly through wet streets at night",
                "waiting at a station with visible anxiety",
                "standing under glowing lights with restless posture",
                "checking the clock repeatedly at a bus terminal",
                "pausing mid-step with alert eyes in a crosswalk",
                "smoking nervously outside a hospital-like hallway",
                "drinking water with shaky hands before a call",
                "walking a collapsing corridor while checking broken seals",
                "stopping under alarm lights while scanning shadows"
            ],
            frustracao: [
                "crossing arms outside a bar with a tense face",
                "staring at unfinished notes in irritation",
                "pacing in a room with restrained annoyance",
                "crumpling paper and exhaling in frustration",
                "sitting on stairs with clenched jaw and tapping foot",
                "finishing a drink in one go with annoyed expression",
                "taking an angry drag from a cigarette and looking away"
            ],
            irritacaoativa: [
                "kicking a pebble while moving through downtown",
                "smoking with sharp gestures under streetlights",
                "moving with abrupt gestures through a narrow corridor",
                "arguing on the phone with intense hand movement",
                "striding through traffic lights with visible impatience",
                "slamming a cup on a counter during heated talk",
                "lighting another cigarette immediately after finishing one"
            ],
            raivaexplosiva: [
                "shouting in an empty street with explosive force",
                "hitting a wall with open hand in frustration",
                "moving forward with intense confrontational energy",
                "throwing a jacket onto the floor with fierce motion",
                "slamming a door and walking away breathing heavily",
                "crushing a can in hand with visible anger",
                "knocking over a chair in a burst of rage"
            ],
            nostalgiaprofunda: [
                "sitting alone with a glass, lost in memory",
                "holding a worn letter by dim window light",
                "staring at old photos in an empty room",
                "listening to rain while tracing old handwriting",
                "sitting on the edge of a bed with distant gaze",
                "smoking silently beside a half-empty glass",
                "waiting alone after closing time at a quiet bar"
            ],
            desanimo: [
                "sitting still on a sofa, gaze lowered",
                "walking slowly with heavy shoulders",
                "staring at a cold drink without reacting",
                "resting against a wall with drained posture",
                "standing under gray sky with motionless expression",
                "sitting in a kitchen at night with untouched food",
                "smoking absentmindedly while staring at nothing",
                "remaining still on an empty rooftop seen from very far away"
            ],
            vulnerabilidadeemocional: [
                "sitting on the floor in quiet emotional release",
                "holding a warm cup with trembling hands",
                "leaning against a wall with fragile posture",
                "covering face briefly before looking up with watery eyes",
                "hugging knees on a couch in soft silence",
                "crying quietly while holding a glass of water",
                "accepting a cigarette from a friend with shaking fingers"
            ],
            ambivalencia: [
                "hesitating between two paths on a street corner",
                "switching between notes with indecisive gestures",
                "staring at reflections with conflicted body language",
                "holding two objects and pausing without deciding",
                "taking one step forward and one back in uncertainty",
                "ordering a drink then changing the order mid-sentence",
                "lighting a cigarette then putting it out immediately",
                "approaching a portal threshold then stepping back",
                "holding two route talismans and switching hands repeatedly"
            ],
            estupor: [
                "sitting motionless on a late-night train",
                "holding an unlit cigarette while staring ahead",
                "standing still in a crowded street, detached",
                "watching traffic pass with blank expression",
                "sitting in a station seat with frozen posture",
                "holding a drink without taking a sip for long minutes",
                "smoking mechanically with no visible reaction",
                "standing still while floating debris passes around",
                "sitting on a platform as dimension doors open and close"
            ],


        };

        if (sentimentActions[key]) {
            return this.random(sentimentActions[key]);
        }

        const actionMap: Record<string, string[]> = {
            euphoric: [
                "running on a rooftop with joyful expression",
                "jumping with spontaneous joy while wearing headphones",
                "laughing while holding a drink can",
                "dancing in the street under vibrant lights",
                "spinning beneath bright billboards with open smile"
            ],
            positive: [
                "leaning on a balcony with a warm smile",
                "drinking a coffee while smiling at the city",
                "chatting with friends while holding a drink",
                "walking with headphones and relaxed posture",
                "watching sunset from a riverside railing"
            ],
            energetic: [
                "smoking near a vibrant-lit alley with intense expression",
                "walking quickly through a crowded avenue",
                "drinking at a street bar with cinematic lighting",
                "walking fast through rainy streets with headphones",
                "running down stairs with determined body language"
            ],
            melancholic: [
                "smoking by the window while rain falls outside",
                "sitting alone with a glass in a dim bar",
                "staring through a rainy window in an empty room",
                "holding a warm drink while staring into the distance",
                "folding an old letter under soft cold light"
            ],
            calm: [
                "sipping tea in a quiet room",
                "sitting quietly in a peaceful corner",
                "reading by the window with a warm drink",
                "resting on a sofa with headphones on",
                "watering plants in soft morning light"
            ],
            balanced: [
                "walking slowly through the city at golden hour",
                "sitting in a cafe with a drink and headphones",
                "sitting in a park during sunset",
                "leaning on a balcony, observing the skyline",
                "crossing a quiet street with reflective expression",
                "slowly pacing along a rooftop edge in a distant establishing shot",
                "crossing a realm bridge while checking surroundings",
                "pausing near a shrine rail then resuming a quiet walk"
            ]
        };

        return this.random(actionMap[intensity] || actionMap["balanced"]);
    }

    private getUniverse(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentUniverse: Record<string, string[]> = {
            EuforiaAtiva: ["floating lantern district above cloud seas", "hidden shinobi village during celestial festival", "sky-bridge metropolis with spirit gateways", "aurora canyon where thunder spirits dance", "sunforge citadel with airborne plazas"],
            ConfiancaDominante: ["fortress capital ruled by elite clans", "cursed academy megacity core", "imperial sky bastion with giant guardian statues", "obsidian command tower over rune valleys", "warrior senate district inside a flying continent"],
            RockEletrizante: ["demon-hunter entertainment district", "volcanic canyon village with fire shrines", "thunder rail city under storm crown", "vibrant abyss quarter powered by cursed cores", "forge-realm colosseum with energy torrents"],
            TensaoCriativa: ["forbidden archive tower with moving staircases", "underground talisman market in a sealed ward", "ink-painted labyrinth city that redraws itself", "clockwork library floating in void", "alchemical atelier district under red moon"],
            AmorCalmo: ["bamboo village beneath twin moons", "wisteria valley with spirit fireflies", "cloud-garden terrace above shrine lakes", "crystal brook hamlet guarded by gentle yokai", "moonbridge town with floating tea houses"],
            ConexaoAfetiva: ["festival bridge linking two spirit realms", "academy courtyard where rival houses unite", "harbor of floating food shrines", "lantern bazaar shared by humans and spirits", "cross-clan village square under comet trails"],
            NostalgiaFeliz: ["old dojo district with living paper charms", "retro sky-train village above golden clouds", "memory shrine alley with echo chimes", "abandoned festival grounds that replay happy illusions", "ancestral courtyard where constellations mirror the past"],
            Serenidade: ["mist temple gardens at first light", "floating island village with slow cloud currents", "moonlit koi sanctum under silent bells", "wind monastery meadow with spirit deer", "starwell cloister with endless calm water"],
            PazInterior: ["snow monastery terrace above sealed valleys", "hidden waterfall sanctuary in crystal cliffs", "spirit-lake pier with mirror stillness", "cloud monastery where time slows down", "inner-realm shrine inside a giant lotus cavern"],
            Contemplacao: ["abandoned observatory above cloud ocean", "giant world-tree branch village at twilight", "torii ridge path under drifting embers", "echo canyon with suspended stone orbs", "astral rooftop between two eclipsed suns"],
            TensaoDramatica: ["collapsed district patrolled by shadow entities", "cursed school ruins with broken seals", "battle-scarred castle street under crimson lightning", "rift corridor where barriers flicker", "warfront bridge over abyssal mist"],
            Frustracao: ["trial grounds filled with failed sigils", "mission bureau maze with endless scroll vaults", "sealed station with constantly locked rune gates", "training arena where gravity shifts unpredictably", "iron monastery corridor of impossible tasks"],
            IrritacaoAtiva: ["combat tournament warmup ring", "ninja exam arena under roaring stands", "storm tunnel with unstable cursed currents", "fractured relay zone with blinking barrier walls", "obsidian street circuit during duel alarms"],
            RaivaExplosiva: ["demon siege frontline in burning ward", "fractured canyon battlefield with colossal blades", "forbidden crater with rupturing seals", "molten citadel outskirts under black thunder", "ruin plain where rage spirits ignite the air"],
            NostalgiaProfunda: ["abandoned clan house covered in spirit moss", "silent memorial path lit by fading soul lanterns", "old swordsmith alley frozen in time", "collapsed shrine quarter echoing old voices", "forgotten moon theater with ghostly rehearsals"],
            Desanimo: ["ruined watchtower beneath pale aurora", "evacuated realm district under ash snowfall", "ashen valley village without voices", "broken gate outpost in endless dusk", "drifting ruin archipelago in gray skies"],
            VulnerabilidadeEmocional: ["safehouse room wrapped in protective talismans", "forest hut hidden by prayer ribbons", "quiet shrine annex after a spirit storm", "healing ward inside crystal caves", "sealed garden where wounded familiars rest"],
            Ambivalencia: ["crossroads between vibrant realm and ancient gate world", "dual-moon district switching day and night", "mirror corridor where both paths feel true", "split-reality bridge with conflicting skies", "twilight plaza that shifts allegiance every minute"],
            Estupor: ["frozen battlefield after a spiritual shockwave", "silent exorcist ward with suspended debris", "void station between converging dimensions", "time-locked avenue where shadows stand still", "hollow observatory in a colorless sky"],
        };

        const matchedUniverse = this.findByNormalizedKey(sentimentUniverse, key);
        if (matchedUniverse) {
            return this.random(matchedUniverse);
        }

        const intensityUniverse: Record<string, string[]> = {
            euphoric: [
                "ninja village festival under comet rain",
                "celestial city above cloud oceans",
                "sky-plaza with dancing spirit lanterns",
                "sunforge terrace in a floating capital",
                "radiant realm avenue with living constellations"
            ],
            positive: [
                "traditional shrine town in a spirit valley",
                "floating tea district with paper lantern skies",
                "moonlit garden city with koi canals",
                "cloud village with warm wooden sanctuaries",
                "gentle realm promenade under twin moons"
            ],
            energetic: [
                "cursed battleground district",
                "combat academy ward with shifting barriers",
                "thunder-realm transit corridor",
                "obsidian arena streets under battle sirens",
                "vibrant spirit quarter with unstable portals"
            ],
            melancholic: [
                "forgotten demon-era town under eternal mist",
                "abandoned hill shrine with broken soul lanterns",
                "silent ruin district beneath cold moonlight",
                "withered spirit garden in gray drizzle",
                "echoing gate path at midnight eclipse"
            ],
            calm: [
                "mountain temple village at dawn mist",
                "floating garden island in soft aurora",
                "crystal cloister with slow drifting petals",
                "quiet lotus cavern sanctuary",
                "spirit-lake monastery pier at first light"
            ],
            balanced: [
                "hybrid realm where vibrant avenue meets ancient torii gate",
                "alternate district blending clan capitals and spirit streets",
                "distant sky-rooftop on a floating megacity",
                "gate-lined promenade between two dimensions",
                "mixed fantasy metropolis with shrine towers and arcane rails"
            ],
        };
        return this.random(intensityUniverse[intensity] || intensityUniverse["balanced"]);
    }

    private getWorldFlavor(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentWorlds: Record<string, string[]> = {
            EuforiaAtiva: ["festival-realm of flying lanterns", "high-energy shinobi celebration world", "radiant sky-city of spirit music"],
            ConfiancaDominante: ["clan-governed fortress realm", "cursed imperial megacity world", "high-command sky bastion civilization"],
            RockEletrizante: ["storm-forged demon-hunter realm", "volcanic combat district world", "vibrant-curse undercity civilization"],
            TensaoCriativa: ["arcane archive labyrinth world", "sigil-market underground realm", "shape-shifting ink metropolis"],
            AmorCalmo: ["moonlit shrine-valley world", "wisteria spirit hamlet civilization", "cloud-tea village realm"],
            ConexaoAfetiva: ["shared spirit-human township world", "festival bridge realm of allied houses", "harbor civilization of floating stalls"],
            NostalgiaFeliz: ["memory-echo dojo realm", "retro sky-rail village world", "ancestral courtyard constellation world"],
            Serenidade: ["mist-temple garden realm", "floating island slow-life world", "moon-koi sanctuary civilization"],
            PazInterior: ["lotus-cavern inner realm", "snow monastery stillness world", "mirror-lake spirit sanctuary"],
            Contemplacao: ["astral observatory world", "world-tree twilight settlement realm", "ember-path torii ridge civilization"],
            TensaoDramatica: ["fractured seal-frontier world", "shadow-patrolled ruin realm", "crimson storm castle district"],
            Frustracao: ["trial-maze training realm", "blocked-rune transit world", "impossible-task iron corridor civilization"],
            IrritacaoAtiva: ["duel-arena pressure world", "exam-ring combat realm", "unstable current tunnel civilization"],
            RaivaExplosiva: ["burning siege frontier realm", "seal-break crater world", "rage-spirit wasteland civilization"],
            NostalgiaProfunda: ["fading memorial lantern realm", "forgotten smithy spirit district", "ghost-theater remembrance world"],
            Desanimo: ["ashen silent-valley realm", "evacuated ruin province world", "endless dusk outpost civilization"],
            VulnerabilidadeEmocional: ["protected talisman safehouse realm", "healing crystal-cave world", "quiet post-storm shrine civilization"],
            Ambivalencia: ["dual-reality crossroads realm", "day-night switching moon district", "mirror-choice corridor world"],
            Estupor: ["time-locked colorless realm", "void transit limbo world", "suspended debris exorcist district"],
        };

        const matchedWorld = this.findByNormalizedKey(sentimentWorlds, key);
        if (matchedWorld) {
            return this.random(matchedWorld);
        }

        const intensityWorlds: Record<string, string[]> = {
            euphoric: ["festival-realm with flying lantern storms", "expansive sky-rooftop fantasy world", "comet-night celebration civilization"],
            energetic: ["kinetic combat district realm", "portal-linked action metropolis world", "thunder corridor warrior civilization"],
            positive: ["warm shrine-town fantasy world", "gentle spirit-neighborhood realm", "optimistic moonbridge village civilization"],
            calm: ["quiet monastery sanctuary realm", "slow cloud-garden fantasy world", "peaceful lotus-valley civilization"],
            melancholic: ["mist-covered ruin realm", "midnight eclipse solitude world", "low-light spirit memory civilization"],
            balanced: ["hybrid gate-and-vibrant fantasy world", "mixed clan-and-spirit realm", "observational multi-realm civilization"],
        };

        return this.random(intensityWorlds[intensity] || intensityWorlds["balanced"]);
    }



    private buildStyleReferences(studio: StudioStyle, referenceAnime: string) {
        return `
Visual style references (very important):

- ${referenceAnime}: use as inspiration for composition, color mood, and facial expression

Blend these references into a cohesive ${studio.name} anime illustration.
Do not copy characters or scenes directly — only use as stylistic guidance.
`;
    }

    private getRandomReferenceAnime(studio: StudioStyle): string {
        if (!studio.referenceAnimes.length) {
            return "original studio visual language";
        }

        return this.random(studio.referenceAnimes);
    }

    private findByNormalizedKey<T>(record: Record<string, T>, sentiment: string): T | undefined {
        const normalizedTarget = this.normalizeSentiment(sentiment);
        for (const [key, value] of Object.entries(record)) {
            if (this.normalizeSentiment(key) === normalizedTarget) {
                return value;
            }
        }

        return undefined;
    }

    // ---------------- UTIL ----------------
    private random<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}