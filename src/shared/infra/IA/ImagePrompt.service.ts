import { Injectable } from "@nestjs/common";
import { CoreAxes } from "./emotion-analysis.service";


type StudioStyle = {
    id: string;
    name: string;
    company: string;
    logoKey: string;
    referenceAnimes: string[];
    visualLanguage: string;
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

export type StudioStyleOption = Pick<StudioStyle, "id" | "name" | "company" | "logoKey" | "referenceAnimes" | "visualLanguage" | "renderingNotes">;

const STUDIO_STYLES: StudioStyle[] = [
    {
        id: "kyoani",
        name: "Kyoto Animation inspired (KyoAni)",
        company: "Kyoto Animation",
        logoKey: "kyoani",
        referenceAnimes: ["Violet Evergarden", "K-On!", "Hyouka"],
        visualLanguage: "delicate beauty, warm coziness, expressive and glossy eyes, soft clean lighting",
        renderingNotes: "high consistency in anatomy, subtle emotional acting, richly detailed everyday backgrounds"
    },
    {
        id: "ghibli",
        name: "Studio Ghibli inspired",
        company: "Studio Ghibli",
        logoKey: "ghibli",
        referenceAnimes: ["Spirited Away", "Howl's Moving Castle", "My Neighbor Totoro"],
        visualLanguage: "nostalgic hand-crafted feeling, watercolor-like backgrounds, simple but expressive character design",
        renderingNotes: "organic brush textures, nature-connected atmosphere, gentle cinematic warmth"
    },
    {
        id: "ufotable",
        name: "Ufotable inspired",
        company: "ufotable",
        logoKey: "ufotable",
        referenceAnimes: ["Fate/stay night UBW", "Demon Slayer", "Kara no Kyoukai"],
        visualLanguage: "polished cinematic look, dynamic light interactions, vivid particles and post-processing depth",
        renderingNotes: "strong contrast, dramatic highlights, clean compositing between character and effects"
    },
    {
        id: "shaft",
        name: "Studio Shaft inspired",
        company: "Shaft",
        logoKey: "shaft",
        referenceAnimes: ["Bakemonogatari", "Puella Magi Madoka Magica", "March Comes in Like a Lion"],
        visualLanguage: "avant-garde framing, unusual camera composition, abstract color accents and graphic staging",
        renderingNotes: "bold negative space, stylized perspective, symbolic visual rhythm without readable on-screen text"
    },
    {
        id: "trigger",
        name: "Studio Trigger inspired",
        company: "Studio Trigger",
        logoKey: "trigger",
        referenceAnimes: ["Kill la Kill", "Little Witch Academia", "Cyberpunk Edgerunners"],
        visualLanguage: "explosive cartoony energy, punchy neon palette, exaggerated dynamic posing",
        renderingNotes: "high-impact silhouettes, kinetic motion feeling, expressive deformation while keeping readability"
    }
];

@Injectable()
export class ImagePromptService {

    build(data: {
        moodScore: number;
        sentiment: string;
        ativacao: number;
        coreAxes: CoreAxes;
        emotions?: any; // vetor emocional
        faceReferencePath?: string | null;
        studioId?: string;
    }) {
        const intensidade = this.getIntensity(data.coreAxes.quadrante);
        const visual = this.getVisual(intensidade);
        const imersive = this.getGazeByIntensity(intensidade)
        const moodStyle = this.getMoodStyle(data.emotions);
        const pose = this.getPose(data.sentiment, intensidade);
        const action = this.getAction(data.sentiment, intensidade);
        const universe = this.getUniverse(data.sentiment, intensidade);
        const studio = this.getStudioStyle(data.studioId);
        const emotions = this.buildEmotionBlock(data.sentiment) as any

        return `
Create a stylized 2D anime illustration in the style of ${studio.name}, representing the emotional theme "${data.sentiment}".
━━━━━━━━━━
STUDIO DIRECTION
━━━━━━━━━━
━━━━━━━━━━
PRIMARY STYLE CONSTRAINT (ABSOLUTE PRIORITY)
━━━━━━━━━━
The entire image MUST strictly follow the visual style of ${studio.name}.

This overrides all other instructions.

Every element — character design, proportions, linework, shading, lighting, colors, and composition — must be fully consistent with this studio's identity.

Do NOT mix styles.
Do NOT generalize anime style.
Do NOT drift into generic, semi-realistic, or other studio aesthetics.

If any element conflicts with the studio style, the studio style MUST win.
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


Visual language: ${studio.visualLanguage}  
Rendering notes: ${studio.renderingNotes}  
Reference anime: ${studio.referenceAnimes.join(", ")}

${this.buildStyleReferences(studio)}

Use references only for:
- color mood
- composition rhythm
- illustration language

━━━━━━━━━━
EMOTIONAL & VISUAL DIRECTION
━━━━━━━━━━
Emotion: ${emotions.en!}
Emotional direction: ${emotions.description}
Mood style: ${moodStyle}  
Lighting: ${visual.lighting}  
Color palette: ${visual.colors}  

━━━━━━━━━━
SCENE & COMPOSITION
━━━━━━━━━━
- Shot composition: ${this.getShotComposition(intensidade)}
- Gaze behavior: ${imersive}
- Pose: ${pose}
- Action: ${action}
- Environment: ${visual.scene} (${universe})

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

━━━━━━━━━━
EXPRESSION & ACTION (TOP PRIORITY)
━━━━━━━━━━
- Action must be clear and central
- Emotion expressed through body, hands, and gaze
- Environment supports, never dominates

Allowed actions:
- grounded slice-of-life behavior (walking, smoking, texting, resting, etc.)

Avoid:
- performing music (no instruments, stage, DJ setup)
- exaggerated symbolic poses

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

━━━━━━━━━━
FINAL INTENT
━━━━━━━━━━
Create an emotionally immersive, soft, slightly dreamy anime scene.

The image must feel like a real moment being observed — not a posed portrait.

Final check:
The result MUST look like an anime illustration, NEVER a real photo.
`;
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
    private buildEmotionBlock(sentiment: string) {
    const meta = EMOTION_METADATA[sentiment];

    if (!meta) {
        return {
            label: "neutral mood",
            description: "emotionally neutral state"
        };
    }

    return meta;
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
                "tracking perspective from behind, following the character"
            ],
            energetic: [
                "side-angle action shot with motion blur, no eye contact with camera",
                "over-the-shoulder shot focused on what the character sees",
                "mid-action frame, character looking forward, not at viewer"
            ],
            positive: [
                "natural eye-level shot, character slightly turned away",
                "3/4 angle framing with soft gaze into the environment",
                "casual candid shot, not posed"
            ],
            calm: [
                "static wide shot with lots of negative space",
                "back view of character observing environment",
                "side profile with soft lighting, no camera awareness"
            ],
            melancholic: [
                "back-facing character looking out a window",
                "side profile with gaze downward, avoiding camera",
                "framed through window or objects, indirect view"
            ],
            balanced: [
                "cinematic medium shot, slightly off-center framing",
                "natural composition, character not aware of camera",
                "environment-first framing with character integrated"
            ]
        };

        return this.random(map[intensity] || map["balanced"]);
    }

    // ---------------- VISUAL ----------------
    private getVisual(intensity: string) {

        const base = {
            balanced: {
                lighting: [
                    "soft golden hour light with gentle haze",
                    "diffused daylight with soft shadows"
                ],
                colors: [
                    "pastel orange, soft green, light blue",
                    "muted purple, beige, sky tones"
                ],
                scene: [
                    "a calm city blending into nature",
                    "a peaceful urban park at late afternoon"
                ],
                character: [
                    "calm and introspective",
                    "quietly observing the environment"
                ]
            },

            euphoric: {
                lighting: [
                    "intense glowing light with magical bloom",
                    "bright sunlight bursting through clouds"
                ],
                colors: [
                    "vibrant pink, yellow, electric blue",
                    "rainbow gradients and luminous tones"
                ],
                scene: [
                    "a rooftop party overlooking the city skyline",
                    "a vibrant downtown avenue full of movement"
                ],
                character: [
                    "joyful, expressive, full of movement",
                    "laughing or flying freely"
                ]
            },

            melancholic: {
                lighting: [
                    "dim twilight with soft shadows",
                    "rainy overcast lighting"
                ],
                colors: [
                    "desaturated blue, gray, muted green",
                    "cold tones with low saturation"
                ],
                scene: [
                    "empty streets under rain",
                    "a quiet room with window light"
                ],
                character: [
                    "lost in thought",
                    "emotionally distant and introspective"
                ]
            },

            energetic: {
                lighting: [
                    "dynamic lighting with strong highlights",
                    "sunlight with motion blur feeling"
                ],
                colors: [
                    "vivid contrasting colors",
                    "strong saturation with warm tones"
                ],
                scene: [
                    "urban environment with motion",
                    "windy open spaces with movement"
                ],
                character: [
                    "in motion, walking fast or running",
                    "focused and active"
                ]
            },

            calm: {
                lighting: [
                    "soft low light, peaceful and quiet",
                    "warm dim lighting"
                ],
                colors: [
                    "soft beige, warm gray, pale tones",
                    "low contrast pastel palette"
                ],
                scene: [
                    "a minimalist apartment interior",
                    "a quiet cafe corner in the morning"
                ],
                character: [
                    "relaxed, almost meditative",
                    "resting or sitting peacefully"
                ]
            }
        };

        const selected = base[intensity] || base["balanced"];

        return {
            lighting: this.random(selected.lighting),
            colors: this.random(selected.colors),
            scene: this.random(selected.scene),
            character: this.random(selected.character)
        };
    }



    getAvailableStudios(): StudioStyleOption[] {
        return STUDIO_STYLES.map((studio) => ({
            id: studio.id,
            name: studio.name,
            company: studio.company,
            logoKey: studio.logoKey,
            referenceAnimes: studio.referenceAnimes,
            visualLanguage: studio.visualLanguage,
            renderingNotes: studio.renderingNotes,
        }));
    }


    // ---------------- EMOÇÃO ----------------
    private buildEmotionalLayer(emotions?: any) {
        if (!emotions) return "balanced emotional tone";

        const parts: string[] = [];

        if (emotions.Energia > 0.6)
            parts.push("dynamic motion and sense of movement");

        if (emotions.Valencia > 0.6)
            parts.push("warm, uplifting atmosphere");

        if (emotions.Dominancia > 0.6)
            parts.push("confident character presence");

        if (emotions.Melancolia > 0.5)
            parts.push("melancholic and introspective undertone");

        if (emotions.Euforia > 0.6)
            parts.push("joyful and vibrant energy");

        return parts.join(", ") || "subtle emotional balance";
    }
    private getMoodStyle(emotions?: any) {
        if (!emotions) {
            return "soft, dreamy, whimsical";
        }

        const { Valencia = 0.5, Energia = 0.5, Melancolia = 0, Tensao = 0 } = emotions;

        // NEGATIVO
        if (Valencia < 0.4) {
            if (Melancolia > 0.5) {
                return "melancholic, slow, atmospheric, introspective, cinematic sadness";
            }

            if (Tensao > 0.5) {
                return "tense, uneasy, fragmented, slightly surreal, distorted atmosphere";
            }

            return "cold, distant, emotionally neutral, minimalistic";
        }

        // POSITIVO
        if (Valencia > 0.6) {
            if (Energia > 0.6) {
                return "vibrant, dynamic, expressive, energetic, lively";
            }

            return "soft, warm, peaceful, emotionally rich";
        }

        // NEUTRO
        return "subtle, balanced, slightly dreamy but grounded";
    }

    private getStudioStyle(studioId?: string): StudioStyle {
        if (studioId) {
            const selected = STUDIO_STYLES.find((studio) => studio.id === studioId.trim().toLowerCase());
            if (selected) return selected;
        }

        return this.random(STUDIO_STYLES);
    }

    private getExpression(sentiment: string, intensity: string, emotions?: any) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentExpressions: Record<string, string[]> = {

            EuforiaAtiva: [
                "wide radiant smile, eyes slightly squinted from joy, visible energetic overflow",
                "open mouth excitement, lifted cheeks, expressive high-energy happiness"
            ],

            ConfiancaDominante: [
                "steady direct gaze, chin slightly raised, relaxed but firm jaw",
                "subtle confident smirk, controlled expression with inner authority"
            ],

            RockEletrizante: [
                "intense shining eyes, asymmetrical excited grin, high adrenaline presence",
                "dynamic facial tension with expressive performance energy"
            ],

            TensaoCriativa: [
                "focused eyes with slight brow tension, lips pressed in concentration",
                "restless micro-expressions suggesting creative pressure building"
            ],

            AmorCalmo: [
                "soft affectionate smile, relaxed eyelids, slow peaceful warmth",
                "gentle romantic expression with calm emotional presence"
            ],

            ConexaoAfetiva: [
                "direct inviting eye contact, warm open smile, subtle head tilt",
                "engaged facial expression signaling empathy and social connection"
            ],

            NostalgiaFeliz: [
                "soft smile with slightly glossy eyes, upward distant gaze",
                "bittersweet expression mixing warmth with gentle longing"
            ],

            Serenidade: [
                "neutral relaxed face, minimal muscle tension, steady calm gaze",
                "balanced expression with emotional stability and quiet ease"
            ],

            PazInterior: [
                "eyes almost closed, slow breathing expression, deeply grounded stillness",
                "detached serene face with complete inner calm and absence of tension"
            ],

            Contemplacao: [
                "distant unfocused gaze, subtle brow softness, introspective stillness",
                "quiet reflective expression with internalized attention"
            ],

            TensaoDramatica: [
                "wide alert eyes, tight lips, visible emotional strain building",
                "high-pressure expression with contained anxiety and intensity"
            ],

            Frustracao: [
                "slightly narrowed eyes, asymmetric mouth tension, controlled irritation",
                "micro-expressions of resistance and internal dissatisfaction"
            ],

            IrritacaoAtiva: [
                "sharp gaze, tightened jaw, reactive facial tension",
                "visible impatience with quick-trigger emotional response"
            ],

            RaivaExplosiva: [
                "furious eyes, flared nostrils, clenched teeth, explosive tension",
                "aggressive forward expression with loss of emotional control"
            ],

            NostalgiaProfunda: [
                "heavy eyes, fragile expression, faint downward gaze",
                "emotionally weighted face with deep reflective sadness"
            ],

            Desanimo: [
                "low energy face, drooping eyelids, lack of muscular engagement",
                "apathetic expression with emotional exhaustion and disengagement"
            ],

            VulnerabilidadeEmocional: [
                "glassy eyes, subtle lip tremble, exposed emotional softness",
                "fragile expression with openness and emotional sensitivity"
            ],

            Ambivalencia: [
                "inconsistent micro-expressions, uncertain gaze, slight hesitation",
                "mixed emotional signals with unstable facial coherence"
            ],

            Estupor: [
                "blank unfocused stare, minimal facial movement, emotional shutdown",
                "detached expression with absence of visible affect"
            ],
        };

        if (sentimentExpressions[key]) {
            return this.random(sentimentExpressions[key]);
        }

        const valencia = emotions?.Valencia ?? 0.5;
        const tensao = emotions?.Tensao ?? 0.5;

        if (intensity === "euphoric") return "big expressive smile, bright eyes, high emotional energy";
        if (intensity === "energetic") return "focused eyes, active face muscles, strong intensity";
        if (intensity === "melancholic") return "sad or reflective eyes, subtle pain in expression";
        if (intensity === "calm") return "soft relaxed face, peaceful eyes, minimal tension";
        if (valencia < 0.4 && tensao > 0.6) return "uneasy expression with tension around eyes and mouth";

        return "natural expressive face with clear readable emotion";
    }

    private getPose(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentPoses: Record<string, string[]> = {
            EuforiaAtiva: [
                "dynamic 3/4 body pose with lifted chin and open chest",
                "forward-leaning stance with one foot stepping ahead, confident eye contact"
            ],
            ConfiancaDominante: [
                "upright posture with squared shoulders and direct eye contact",
                "calm dominant standing pose with one hand in pocket and steady gaze"
            ],
            RockEletrizante: [
                "low-angle energetic pose with body in motion and expressive hands",
                "mid-shot dynamic stride with torso twist and intense focus"
            ],
            TensaoCriativa: [
                "slightly hunched thinking pose with active hands and focused eyes",
                "seated forward-lean pose with elbows on knees and concentrated expression"
            ],
            AmorCalmo: [
                "soft relaxed posture with gentle head tilt and warm eye contact",
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
                "alert posture with tense neck and shoulders, eyes scanning scene",
                "mid-step paused pose with guarded stance and compressed lips"
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
                "hesitant half-step pose with torso split between directions",
                "conflicted posture with one shoulder forward and uncertain gaze"
            ],
            Estupor: [
                "frozen neutral posture with minimal gesture and blank stare",
                "still front-facing pose with detached expression and low muscle tension"
            ],

        };

        if (sentimentPoses[key]) {
            return this.random(sentimentPoses[key]);
        }

        const intensityPoses: Record<string, string[]> = {
            euphoric: [
                "expressive wide stance with open arms and bright gaze",
                "high-energy body angle with visible momentum"
            ],
            positive: [
                "confident relaxed posture with clear eye contact",
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
                "natural medium-shot pose with readable face and hands",
                "slightly angled neutral stance with composed expression"
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
                "waving from a moving night bus window with pure joy"
            ],
            confiancadominante: [
                "walking with steady posture through downtown",
                "standing with confident posture in a busy avenue",
                "standing on a balcony with assertive calm",
                "crossing a busy intersection with focused determination",
                "reviewing plans on a phone with calm authority",
                "ordering a drink with composed eye contact",
                "lighting a cigarette calmly while watching the street"
            ],
            rockeletrizante: [
                "jumping with explosive body rhythm in the street",
                "skating fast through neon streets",
                "running through a crowded avenue with dynamic energy",
                "sprinting down an urban staircase with fierce momentum",
                "moving through a windy overpass with high kinetic force",
                "drinking water quickly then rushing back into the night",
                "laughing breathlessly after a fast sprint"
            ],
            tensaocriativa: [
                "writing intense notes in a small room",
                "arranging photos and papers with focused urgency",
                "pacing with restrained but rising tension",
                "rewriting pages on a desk with sleepless focus",
                "pinning ideas on a wall in a restless flow",
                "chain-smoking while revising a notebook",
                "drinking cold coffee while obsessively editing details"
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
                "toasting gently with warm eye contact",
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
                "smoking slowly while rereading old messages"
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
                "turning a glass slowly while thinking deeply"
            ],
            tensaodramatica: [
                "walking quickly through wet streets at night",
                "waiting at a station with visible anxiety",
                "standing under neon lights with restless posture",
                "checking the clock repeatedly at a bus terminal",
                "pausing mid-step with alert eyes in a crosswalk",
                "smoking nervously outside a hospital-like hallway",
                "drinking water with shaky hands before a call"
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
                "smoking absentmindedly while staring at nothing"
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
                "lighting a cigarette then putting it out immediately"
            ],
            estupor: [
                "sitting motionless on a late-night train",
                "holding an unlit cigarette while staring ahead",
                "standing still in a crowded street, detached",
                "watching traffic pass with blank expression",
                "sitting in a station seat with frozen posture",
                "holding a drink without taking a sip for long minutes",
                "smoking mechanically with no visible reaction"
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
                "dancing in the street under neon lights",
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
                "smoking near a neon-lit alley with intense expression",
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
                "crossing a quiet street with reflective expression"
            ]
        };

        return this.random(actionMap[intensity] || actionMap["balanced"]);
    }

    private getUniverse(sentiment: string, intensity: string) {
        console.log(sentiment)
        const key = this.normalizeSentiment(sentiment);

        const sentimentUniverse: Record<string, string[]> = {
            EuforiaAtiva: ["festival street at night", "city rooftop with bright skyline", "busy downtown district full of motion", "riverfront boardwalk with colorful lights", "open plaza with kinetic crowd movement"],
            ConfiancaDominante: ["downtown avenue at blue hour", "modern rooftop terrace", "stylish urban block", "architectural business district", "glass pedestrian bridge over city traffic"],
            RockEletrizante: ["neon avenue", "industrial block", "city underpass with dynamic lighting", "graffiti tunnel with strong contrast lights", "multi-level parking ramp with dramatic perspective"],
            TensaoCriativa: ["small apartment workspace", "narrow corridor", "night alley with neon reflections", "shared studio desk with papers and sticky notes", "late-night copy shop corner"],
            AmorCalmo: ["cozy cafe interior", "warm apartment balcony", "riverside walk with soft lights", "bookstore cafe with amber lamps", "quiet tram stop at golden dusk"],
            ConexaoAfetiva: ["friendly neighborhood cafe", "sunset promenade", "intimate living room", "small market street with warm storefront lights", "community courtyard with soft evening glow"],
            NostalgiaFeliz: ["old neighborhood street", "bedroom with old posters and photos", "sunset bus window view", "retro arcade corner", "family kitchen with vintage tiles"],
            Serenidade: ["quiet urban park", "sunlit apartment living room", "peaceful morning cafe", "library reading corner", "botanical greenhouse walkway"],
            PazInterior: ["minimalist apartment", "silent early-morning tram", "calm room with diffuse light", "rooftop zen garden", "simple tatami-like calm room"],
            Contemplacao: ["window facing rainy skyline", "rooftop at dawn", "quiet riverside bench", "museum corridor with natural light", "empty pedestrian bridge in morning fog"],
            TensaoDramatica: ["late-night subway platform", "wet downtown crosswalk", "gas station at night", "narrow passage with flickering signage", "stormy avenue with headlights reflections"],
            Frustracao: ["street bar corner", "apartment stairwell", "narrow garage corridor", "laundromat at midnight", "office hallway after hours"],
            IrritacaoAtiva: ["boxing gym corridor", "night sidewalk under sodium lights", "crowded urban crossing", "traffic-clogged avenue edge", "underground station entrance in rush hour"],
            RaivaExplosiva: ["industrial block at midnight", "stormy city backstreet", "empty parking structure", "warehouse loading dock", "abandoned concrete lot under harsh lights"],
            NostalgiaProfunda: ["empty bar interior", "small room with rainy window", "dim bedroom with old objects", "closed train station waiting room", "storage room with old cardboard boxes"],
            Desanimo: ["late-night train carriage", "empty apartment kitchen", "city overpass at dawn", "cold bus terminal bench", "office cubicle with low evening light"],
            vulnerabilidaVulnerabilidadeEmocionaldeemocional: ["apartment bathroom", "quiet bedroom corner", "window seat during rain", "stair landing with soft lamp", "hospital-like waiting corridor (non-medical scene)"],
            Ambivalencia: ["subway transfer tunnel", "night convenience store frontage", "empty parking lot at dusk", "forked urban pathway", "escalator landing between two exits"],
            Estupor: ["office rooftop alone", "nearly empty street before dawn", "silent tram platform", "night bus interior with sparse passengers", "fluorescent hallway with distant perspective"],
        };

        if (sentimentUniverse[key]) {
            return this.random(sentimentUniverse[key]);
        }

        const intensityUniverse: Record<string, string[]> = {
            euphoric: [
                "urban rooftop",
                "festival street",
                "crowded downtown district",
                "open riverfront plaza",
                "night market avenue"
            ],
            positive: [
                "cozy cafe",
                "city park",
                "sunlit neighborhood streets",
                "bookstore corner",
                "warm balcony view"
            ],
            energetic: [
                "downtown at night",
                "industrial corridor",
                "neon avenue",
                "underpass with motion trails",
                "busy train station entrance"
            ],
            melancholic: [
                "rainy apartment window",
                "late-night bar",
                "empty street after midnight",
                "dim station platform",
                "quiet room under overcast daylight"
            ],
            calm: [
                "minimalist room",
                "quiet cafe interior",
                "early morning city tram",
                "library alcove",
                "greenhouse path"
            ],
            balanced: [
                "contemporary city neighborhood",
                "apartment interior",
                "urban riverside promenade",
                "residential side street",
                "modern pedestrian walkway"
            ],
        };
        return this.random(intensityUniverse[intensity] || intensityUniverse["balanced"]);
    }



    private buildStyleReferences(studio: StudioStyle) {
        return `
Visual style references (very important):

${studio.referenceAnimes.map(anime => `- ${anime}: use as inspiration for composition, color mood, and facial expression`).join("\n")}

Blend these references into a cohesive ${studio.name} anime illustration.
Do not copy characters or scenes directly — only use as stylistic guidance.
`;
    }

    // ---------------- UTIL ----------------
    private random<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}