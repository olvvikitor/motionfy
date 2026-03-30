import { Injectable } from "@nestjs/common";


type StudioStyle = {
    id: string;
    name: string;
    company: string;
    logoKey: string;
    referenceAnimes: string[];
    visualLanguage: string;
    renderingNotes: string;
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
        emotions?: any; // vetor emocional
        faceReferencePath?: string | null;
        studioId?: string;
    }) {
        const intensidade = this.getIntensity(data.moodScore, data.ativacao);
        const visual = this.getVisual(intensidade);
        const emotionLayer = this.buildEmotionalLayer(data.emotions);
        const moodStyle = this.getMoodStyle(data.emotions);
        const pose = this.getPose(data.sentiment, intensidade);
        const camera = this.getCamera();
        const framing = this.getFramingRule();
        const action = this.getAction(data.sentiment, intensidade);
        const universe = this.getUniverse(data.sentiment, intensidade);
        const expression = this.getExpression(data.sentiment, intensidade, data.emotions);
        const studio = this.getStudioStyle(data.studioId);

        return `
Create a stylized artistic image in a ${studio.name} style that represents the emotional theme "${data.sentiment}".

The image should visually express the feeling through colors, lighting, atmosphere, and character presence.
Prioritize the character over the environment.

Medium and rendering requirements (mandatory):
- Output must be a stylized 2D anime illustration, not a photo
- Keep visible illustration traits: clean linework, painterly/anime shading, stylized proportions
- Preserve a hand-crafted cel-animated / anime-film feeling
- Do not generate HD, ultra-detailed, 4K, or hyper-sharp output
- Prefer medium-detail illustration with soft edges over crisp realistic detail
- Do not use photoreal skin texture, realistic camera noise, DSLR look, or cinematic live-action grading
- Do not simulate real-lens photography (no real bokeh photography artifacts, no film grain realism)
- If the render starts to look realistic, force it back to an illustrated anime drawing style

Style direction: ${studio.name}
${this.buildStyleReferences(studio)}
Studio visual language: ${studio.visualLanguage}
Studio rendering notes: ${studio.renderingNotes}
Studio reference anime titles: ${studio.referenceAnimes.join(", ")}
Use these titles only as style reference for composition rhythm, color mood, and illustration language.
Mood style: ${moodStyle}
Lighting: ${visual.lighting}
Color palette: ${visual.colors}
- Camera: ${camera}
- Pose: ${pose}
- Action: ${action}
- Framing: ${framing}
- Universe: ${universe}
- Expression direction: ${expression}

Reference image:
- User face reference path: ${data.faceReferencePath ?? "not provided"}
- Use the provided face reference image as appearance baseline (face shape, hair line, eyes, eyebrows, nose, mouth proportions)
- Preserve recognizability of the person while adapting to the selected anime studio style
- Never copy photographic skin texture, camera lighting, or real-photo rendering from the face reference
- Reference image must guide identity only; final render must remain fully illustrated anime

Emotional direction:
- ${emotionLayer}

Expression & action priorities (highest priority):
- The face expression must clearly communicate the mood at first glance
- The selected action must be unambiguous and central in the frame
- Hands, eyes, and body gesture should reinforce the emotion
- Keep environment as context only, never as the main subject
- Never depict the character playing instruments, singing, performing, DJing, or inside a concert stage setup
- Optional audio props are allowed only as secondary elements: headphones or speakers
- Real-world human actions are welcome when emotionally coherent: smoking, drinking, walking alone, waiting for transport, texting, journaling, cooking, resting, arguing, hugging, crying, laughing
- Prefer grounded slice-of-life behavior over abstract symbolic poses

Elements to consider:
- Environment: ${visual.scene} (${universe})

Character requirements:
- The character should be portrayed as a young adult
- Avoid gender ambiguity unless specified
- Show clear facial details (eyes, eyebrows, mouth) with readable emotion
- Avoid tiny, distant, or silhouette-only characters
- Keep similarity to the user face reference image as high priority

Style enforcement (critical):

- This MUST be a stylized 2D anime illustration
- No photorealism under any circumstances
- No semi-realistic rendering
- No 3D or CGI look
- No cinematic live-action appearance

If any part looks realistic, override it into anime illustration style with visible linework and stylized shading.

Avoid: realistic photography, photorealism, hyper-realism, CGI realism, 3D render look, live-action look, HD render, 4K detail, ultra-sharp texture detail, low quality, blurry, distorted faces, extra limbs, text, watermark
Avoid music-performance elements: guitars, drums, microphones, pianos, violins, DJ decks, recording studio setups, stage performance poses
Avoid fantasy clichés: castles, medieval armor, dragons, kings/queens, magical creatures, fantasy kingdoms
Strict integrity constraints:
- Single main character only (unless explicitly requested otherwise)
- Exactly one face for the main character (no duplicated heads or ghost faces)
- Correct human anatomy: two arms, two hands, five fingers per visible hand
- No extra fingers, fused fingers, duplicated hands, or floating limbs
- No duplicated body parts (arms, legs, ears, eyes, mouth)
- No cloned or repeated objects (duplicate cups, cigarettes, phones, glasses, chairs) unless intentionally part of the scene logic
- No mirrored duplicate props near hands
- Keep object interaction physically coherent (hands correctly holding objects)
- Keep perspective and occlusion consistent; no overlapping impossible geometry
- If anatomy or object count is ambiguous, prefer a simpler composition with fewer visible limbs/props

Make it emotionally immersive, soft, dreamy, and slightly surreal.
Final output check before generation:
- The final image must read immediately as an anime drawing/illustration, never as a real photo.
`;
    }

    // ---------------- INTENSIDADE ----------------
    private getIntensity(score: number, ativacao: number) {
        if (score > 0.8 && ativacao > 0.6) return "euphoric";
        if (score > 0.6 && ativacao > 0.3) return "positive";
        if (score < 0.3 && ativacao < -0.5) return "melancholic";
        if (ativacao > 0.6) return "energetic";
        if (ativacao < -0.6) return "calm";
        return "balanced";
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
            euforiaativa: ["radiant smile, sparkling eyes, infectious excitement", "joyful open expression with visible emotional overflow"],
            confiancadominante: ["steady confident gaze, relaxed jaw, self-assured expression", "uplifted chin, focused eyes, calm determination"],
            rockeletrizante: ["bright intense eyes, excited grin, high performance energy", "expressive face with dynamic upbeat tension"],
            tensaocriativa: ["concentrated stare, slight brow tension, creative restlessness", "focused expression balancing tension and drive"],
            amorcalmo: ["gentle smile, warm eyes, affectionate serenity", "soft romantic expression with peaceful calm"],
            conexaoafetiva: ["welcoming eyes, tender smile, emotionally open expression", "friendly warm expression with social closeness"],
            nostalgiafeliz: ["nostalgic smile with bright moist eyes", "tender expression blending longing and gratitude"],
            serenidade: ["soft neutral smile, tranquil eyes, relaxed features", "peaceful expression with effortless calm"],
            pazinterior: ["meditative face, slow-breathing calm, almost weightless gaze", "deeply relaxed expression with inner stillness"],
            contemplacao: ["thoughtful distant gaze, quiet introspection", "reflective expression with subtle emotional depth"],
            tensaodramatica: ["wide alert eyes, compressed lips, visible inner pressure", "anxious intense expression with dramatic emotional load"],
            frustracao: ["frustrated expression, narrowed eyes, restrained irritation", "annoyed face with controlled emotional friction"],
            irritacaoativa: ["angry eyebrows, tense jaw, reactive expression", "irritated stare with sharp facial tension"],
            raivaexplosiva: ["furious eyes, clenched jaw, explosive anger", "aggressive intense expression with high confrontation"],
            nostalgiaprofunda: ["sad nostalgic eyes, fragile half-smile", "emotionally heavy expression with deep longing"],
            desanimo: ["drained gaze, low facial energy, visible emotional fatigue", "apathetic expression with subtle sadness"],
            vulnerabilidadeemocional: ["watery eyes, fragile expression, emotional exposure", "soft vulnerable face with visible sensitivity"],
            ambivalencia: ["uncertain eyes, conflicted expression, mixed emotion", "hesitant facial expression with emotional ambiguity"],
            estupor: ["blank stare, emotionally numb expression", "detached eyes with minimal facial reaction"],
            // Legacy aliases for compatibility
            surtando: ["furious eyes, clenched jaw, explosive energy", "wide intense eyes, aggressive posture, visible tension"],
            adrenalinapura: ["excited eyes, open smile, adrenaline in body language", "focused joyful expression with energetic movement"],
            caoscontrolado: ["intense focused gaze, restless expression", "confident but edgy face, controlled tension"],
            pressentindo: ["suspicious eyes, subtle anxiety in expression", "alert gaze with uneasy facial tension"],
            decara: ["frustrated expression, pressed lips, narrowed eyes", "annoyed face with visible emotional load"],
            pdavida: ["angry eyebrows, tense jaw, confrontational stare", "irritated expression with sharp body gesture"],
            apaixonadx: ["soft smile, warm eyes, affectionate expression", "romantic gaze with gentle facial softness"],
            saudadeboa: ["nostalgic half-smile, teary bright eyes", "tender expression mixing joy and longing"],
            chorandonobanheiro: ["watery eyes, fragile expression, emotional exhaustion", "sad face with visible vulnerability"],
            deboa: ["relaxed smile, calm gaze, peaceful expression", "light and effortless expression"],
            zerado: ["serene neutral face, slow breathing vibe", "meditative expression with gentle eyes"],
            toconfuso: ["uncertain eyes, conflicted expression", "hesitant face with mixed emotion"],
            travado: ["blank stare, emotionally numb expression", "detached eyes, minimal facial reaction"],
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
            euforiaativa: [
                "dynamic 3/4 body pose with lifted chin and open chest",
                "forward-leaning stance with one foot stepping ahead, confident eye contact"
            ],
            confiancadominante: [
                "upright posture with squared shoulders and direct eye contact",
                "calm dominant standing pose with one hand in pocket and steady gaze"
            ],
            rockeletrizante: [
                "low-angle energetic pose with body in motion and expressive hands",
                "mid-shot dynamic stride with torso twist and intense focus"
            ],
            tensaocriativa: [
                "slightly hunched thinking pose with active hands and focused eyes",
                "seated forward-lean pose with elbows on knees and concentrated expression"
            ],
            amorcalmo: [
                "soft relaxed posture with gentle head tilt and warm eye contact",
                "side-facing 3/4 pose with subtle smile and peaceful shoulders"
            ],
            conexaoafetiva: [
                "open body language with inviting shoulders and kind expression",
                "natural standing pose with relaxed arms and emotionally available gaze"
            ],
            nostalgiafeliz: [
                "still reflective pose with slight smile and eyes looking into distance",
                "seated window-side posture with soft shoulders and nostalgic gaze"
            ],
            serenidade: [
                "balanced neutral pose with relaxed spine and calm breathing",
                "minimal movement portrait pose with gentle gaze and loose shoulders"
            ],
            pazinterior: [
                "meditative straight posture with soft hands and closed or half-closed eyes",
                "centered seated pose with serene face and grounded shoulders"
            ],
            contemplacao: [
                "side-profile contemplative pose looking at horizon",
                "quiet standing pose with chin slightly raised and thoughtful eyes"
            ],
            tensaodramatica: [
                "alert posture with tense neck and shoulders, eyes scanning scene",
                "mid-step paused pose with guarded stance and compressed lips"
            ],
            frustracao: [
                "closed posture with crossed arms and tightened jaw",
                "seated pose with elbows on thighs and visible irritation"
            ],
            irritacaoativa: [
                "restless stance with uneven weight distribution and sharp gestures",
                "half-turned reactive pose with tense jaw and narrowed eyes"
            ],
            raivaexplosiva: [
                "forward confrontational stance with clenched fists and intense stare",
                "wide-leg aggressive pose with elevated shoulders and explosive energy"
            ],
            nostalgiaprofunda: [
                "curled seated posture with lowered shoulders and distant gaze",
                "static side pose with heavy expression and subtle inward body tension"
            ],
            desanimo: [
                "slouched posture with lowered head and drained body language",
                "slow-standing pose with rounded shoulders and tired eyes"
            ],
            vulnerabilidadeemocional: [
                "fragile seated pose hugging knees or holding arms gently",
                "soft defensive posture with slightly collapsed shoulders and watery eyes"
            ],
            ambivalencia: [
                "hesitant half-step pose with torso split between directions",
                "conflicted posture with one shoulder forward and uncertain gaze"
            ],
            estupor: [
                "frozen neutral posture with minimal gesture and blank stare",
                "still front-facing pose with detached expression and low muscle tension"
            ],
            // Legacy aliases for compatibility
            surtando: [
                "explosive forward-leaning pose with intense eyes",
                "chaotic angular stance with visible body tension"
            ],
            adrenalinapura: [
                "running-like dynamic pose with raised chest and focused smile",
                "athletic motion pose with strong diagonal body line"
            ],
            caoscontrolado: [
                "composed but tense posture with active hands",
                "confident stance with subtle asymmetry and controlled energy"
            ],
            pressentindo: [
                "slightly turned alert pose with cautious side glance",
                "defensive posture with raised shoulders and suspicious gaze"
            ],
            decara: [
                "rigid posture with crossed arms and frustrated expression",
                "angled stance with chin down and annoyed eye contact"
            ],
            pdavida: [
                "hard confrontational stance with tense jaw",
                "forward pressure pose with intense narrowed gaze"
            ],
            apaixonadx: [
                "soft open posture with gentle smile and affectionate eyes",
                "romantic close-up pose with slight head tilt and relaxed shoulders"
            ],
            saudadeboa: [
                "quiet reflective pose with warm half-smile",
                "window-side seated pose with nostalgic upward glance"
            ],
            chorandonobanheiro: [
                "collapsed seated pose with fragile shoulders",
                "emotionally exposed pose with face partially covered by hands"
            ],
            deboa: [
                "easy relaxed standing pose with soft smile",
                "casual seated pose with open chest and calm gaze"
            ],
            zerado: [
                "still centered posture with meditative calm",
                "neutral portrait pose with serene eyes and relaxed mouth"
            ],
            toconfuso: [
                "uncertain asymmetric pose with hesitant head angle",
                "conflicted stance with questioning expression and unstable balance"
            ],
            travado: [
                "motionless frontal pose with fixed distant eyes",
                "stiff posture with minimal gesture and emotional shutdown"
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

            // Legacy aliases for compatibility
            surtando: [
                "smoking outside a convenience store at night",
                "arguing with themselves in a dark alley",
                "walking fast in the rain with a drink can in hand"
            ],
            adrenalinapura: [
                "running on a rooftop at sunset",
                "shouting with joy in an open avenue",
                "skating through downtown with headphones"
            ],
            caoscontrolado: [
                "smoking while writing notes in a small room",
                "moving intensely in a basement corridor",
                "drinking coffee while organizing tasks at night"
            ],
            pressentindo: [
                "smoking near a neon-lit alley with a tense expression",
                "waiting at a late-night bus stop holding a drink",
                "walking alone through wet streets after midnight"
            ],
            decara: [
                "smoking outside a bar with crossed arms",
                "staring at the wall in a dim room",
                "sitting silent at a counter with a half-full glass"
            ],
            pdavida: [
                "kicking a pebble while walking through downtown",
                "smoking with an intense stare under streetlights",
                "walking with clenched fists through a busy block"
            ],
            apaixonadx: [
                "sharing a drink in a cozy bar",
                "walking hand in hand through evening streets",
                "holding someone close on a balcony"
            ],
            saudadeboa: [
                "holding an old photo with coffee on a kitchen table",
                "revisiting old messages in the bedroom",
                "watching city lights from the window with a warm drink"
            ],
            chorandonobanheiro: [
                "sitting on the bathroom floor after a night out",
                "smoking by the window while rain falls outside",
                "holding a glass at a dim bar, lost in thought"
            ],
            deboa: [
                "sipping coffee by a window in the morning",
                "reading in a cafe during a quiet afternoon",
                "resting on a bench while observing the street"
            ],
            zerado: [
                "drinking tea in a minimalist room",
                "journaling at a quiet cafe table",
                "resting on the sofa in silence"
            ],
            toconfuso: [
                "standing in front of convenience store lights at night",
                "switching between two options in a messy room",
                "staring at a half-finished drink in silence"
            ],
            travado: [
                "sitting motionless on a late-night train",
                "holding an unlit cigarette while staring ahead",
                "standing still in a crowded street, detached"
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
        const key = this.normalizeSentiment(sentiment);

        const sentimentUniverse: Record<string, string[]> = {
            euforiaativa: ["festival street at night", "city rooftop with bright skyline", "busy downtown district full of motion", "riverfront boardwalk with colorful lights", "open plaza with kinetic crowd movement"],
            confiancadominante: ["downtown avenue at blue hour", "modern rooftop terrace", "stylish urban block", "architectural business district", "glass pedestrian bridge over city traffic"],
            rockeletrizante: ["neon avenue", "industrial block", "city underpass with dynamic lighting", "graffiti tunnel with strong contrast lights", "multi-level parking ramp with dramatic perspective"],
            tensaocriativa: ["small apartment workspace", "narrow corridor", "night alley with neon reflections", "shared studio desk with papers and sticky notes", "late-night copy shop corner"],
            amorcalmo: ["cozy cafe interior", "warm apartment balcony", "riverside walk with soft lights", "bookstore cafe with amber lamps", "quiet tram stop at golden dusk"],
            conexaoafetiva: ["friendly neighborhood cafe", "sunset promenade", "intimate living room", "small market street with warm storefront lights", "community courtyard with soft evening glow"],
            nostalgiafeliz: ["old neighborhood street", "bedroom with old posters and photos", "sunset bus window view", "retro arcade corner", "family kitchen with vintage tiles"],
            serenidade: ["quiet urban park", "sunlit apartment living room", "peaceful morning cafe", "library reading corner", "botanical greenhouse walkway"],
            pazinterior: ["minimalist apartment", "silent early-morning tram", "calm room with diffuse light", "rooftop zen garden", "simple tatami-like calm room"],
            contemplacao: ["window facing rainy skyline", "rooftop at dawn", "quiet riverside bench", "museum corridor with natural light", "empty pedestrian bridge in morning fog"],
            tensaodramatica: ["late-night subway platform", "wet downtown crosswalk", "gas station at night", "narrow passage with flickering signage", "stormy avenue with headlights reflections"],
            frustracao: ["street bar corner", "apartment stairwell", "narrow garage corridor", "laundromat at midnight", "office hallway after hours"],
            irritacaoativa: ["boxing gym corridor", "night sidewalk under sodium lights", "crowded urban crossing", "traffic-clogged avenue edge", "underground station entrance in rush hour"],
            raivaexplosiva: ["industrial block at midnight", "stormy city backstreet", "empty parking structure", "warehouse loading dock", "abandoned concrete lot under harsh lights"],
            nostalgiaprofunda: ["empty bar interior", "small room with rainy window", "dim bedroom with old objects", "closed train station waiting room", "storage room with old cardboard boxes"],
            desanimo: ["late-night train carriage", "empty apartment kitchen", "city overpass at dawn", "cold bus terminal bench", "office cubicle with low evening light"],
            vulnerabilidadeemocional: ["apartment bathroom", "quiet bedroom corner", "window seat during rain", "stair landing with soft lamp", "hospital-like waiting corridor (non-medical scene)"],
            ambivalencia: ["subway transfer tunnel", "night convenience store frontage", "empty parking lot at dusk", "forked urban pathway", "escalator landing between two exits"],
            estupor: ["office rooftop alone", "nearly empty street before dawn", "silent tram platform", "night bus interior with sparse passengers", "fluorescent hallway with distant perspective"],

            // Legacy aliases for compatibility
            surtando: ["night downtown district", "dark side street", "rainy city blocks"],
            adrenalinapura: ["city rooftop at sunset", "busy urban avenue", "open downtown plaza"],
            caoscontrolado: ["small apartment workspace", "industrial neighborhood at dusk", "building service corridor"],
            pressentindo: ["neon-lit side street", "late-night subway platform", "quiet gas station at night"],
            decara: ["street bar corner", "apartment stairwell", "night sidewalk under sodium lights"],
            pdavida: ["downtown crosswalk", "boxing gym corridor", "garage corner"],
            apaixonadx: ["cozy bar interior", "city promenade at night", "apartment balcony with warm lights"],
            saudadeboa: ["old neighborhood cafe", "bedroom with posters and old photos", "sunset bus window view"],
            chorandonobanheiro: ["apartment bathroom", "empty bar restroom", "small room with rainy window"],
            deboa: ["quiet cafe", "urban park bench", "sunlit apartment living room"],
            zerado: ["minimalist apartment", "bookstore cafe", "morning tram ride"],
            toconfuso: ["night convenience store frontage", "subway transfer tunnel", "empty parking lot at dusk"],
            travado: ["late-night train carriage", "office rooftop alone", "city overpass at dawn"],
        };

        if (sentimentUniverse[key]) {
            return this.random(sentimentUniverse[key]);
        }

        const intensityUniverse: Record<string, string[]> = {
            euphoric: ["urban rooftop", "festival street", "crowded downtown district", "open riverfront plaza", "night market avenue"],
            positive: ["cozy cafe", "city park", "sunlit neighborhood streets", "bookstore corner", "warm balcony view"],
            energetic: ["downtown at night", "industrial corridor", "neon avenue", "underpass with motion trails", "busy train station entrance"],
            melancholic: ["rainy apartment window", "late-night bar", "empty street after midnight", "dim station platform", "quiet room under overcast daylight"],
            calm: ["minimalist room", "quiet cafe interior", "early morning city tram", "library alcove", "greenhouse path"],
            balanced: ["contemporary city neighborhood", "apartment interior", "urban riverside promenade", "residential side street", "modern pedestrian walkway"],
        };

        return this.random(intensityUniverse[intensity] || intensityUniverse["balanced"]);
    }

    private getCamera() {
        return this.random([
            "close-up shot",
            "close-up shot focused on facial emotion",
            "medium shot with clear action visibility",
            "medium-close cinematic shot",
            "eye-level shot",
            "slightly tilted cinematic angle"
        ]);
    }
    private getFramingRule() {
        return this.random([
            "the character's face must be clearly visible",
            "focus on facial expression and emotion",
            "the action must be readable in one glance",
            "character should occupy most of the frame",
            "avoid back-facing pose or distant full-body framing"
        ]);
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