import { Injectable } from "@nestjs/common";


type StudioStyle = {
    name: string;
    visualLanguage: string;
    renderingNotes: string;
};

@Injectable()
export class ImagePromptService {

    build(data: {
        moodScore: number;
        sentiment: string;
        ativacao: number;
        emotions?: any; // vetor emocional
        faceReferencePath?: string | null;
    }) {
        console.log(data)
        const intensidade = this.getIntensity(data.moodScore, data.ativacao);
        const visual = this.getVisual(intensidade);
        const archetype = this.getArchetype();
        const emotionLayer = this.buildEmotionalLayer(data.emotions);
        const moodStyle = this.getMoodStyle(data.emotions);
        const pose = this.getPose();
        const camera = this.getCamera();
        const framing = this.getFramingRule();
        const action = this.getAction(data.sentiment, intensidade);
        const universe = this.getUniverse(data.sentiment, intensidade);
        const expression = this.getExpression(data.sentiment, intensidade, data.emotions);
        const studio = this.getStudioStyle();

        return `
Create a high-quality artistic image in a Studio Ghibli-inspired style that represents the emotional theme "${data.sentiment}".

The image should visually express the feeling through colors, lighting, atmosphere, and character presence.
Prioritize the character over the environment.

Style direction: ${studio.name}
Studio visual language: ${studio.visualLanguage}
Studio rendering notes: ${studio.renderingNotes}
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

Emotional direction:
- ${emotionLayer}

Expression & action priorities (highest priority):
- The face expression must clearly communicate the mood at first glance
- The selected action must be unambiguous and central in the frame
- Hands, eyes, and body gesture should reinforce the emotion
- Keep environment as context only, never as the main subject
- Never depict the character playing instruments, singing, performing, DJing, or inside a concert stage setup
- Optional audio props are allowed only as secondary elements: headphones or speakers

Elements to consider:
- Environment: ${visual.scene} (${universe})
- Character archetype: ${archetype}

Character requirements:
- The character should be portrayed as a young adult
- Avoid gender ambiguity unless specified
- Show clear facial details (eyes, eyebrows, mouth) with readable emotion
- Avoid tiny, distant, or silhouette-only characters
- Keep similarity to the user face reference image as high priority

Avoid: realistic photography, hyper-realism, low quality, blurry, distorted faces, extra limbs, text, watermark
Avoid music-performance elements: guitars, drums, microphones, pianos, violins, DJ decks, recording studio setups, stage performance poses
Avoid fantasy clichés: castles, medieval armor, dragons, kings/queens, magical creatures, fantasy kingdoms

Make it emotionally immersive, soft, dreamy, and slightly surreal.
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


    // ---------------- ARQUÉTIPO ----------------
    private getArchetype() {
        return this.random([
            "dreamer",
            "wanderer",
            "artist",
            "loner",
            "explorer",
            "urban soul",
            "student"
        ]);
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

    private getStudioStyle(): StudioStyle {
        return this.random([
            {
                name: "Kyoto Animation inspired (KyoAni)",
                visualLanguage: "delicate beauty, warm coziness, expressive and glossy eyes, soft clean lighting",
                renderingNotes: "high consistency in anatomy, subtle emotional acting, richly detailed everyday backgrounds"
            },
            {
                name: "Studio Ghibli inspired",
                visualLanguage: "nostalgic hand-crafted feeling, watercolor-like backgrounds, simple but expressive character design",
                renderingNotes: "organic brush textures, nature-connected atmosphere, gentle cinematic warmth"
            },
            {
                name: "Ufotable inspired",
                visualLanguage: "polished cinematic look, dynamic light interactions, vivid particles and post-processing depth",
                renderingNotes: "strong contrast, dramatic highlights, clean compositing between character and effects"
            },
            {
                name: "Studio Shaft inspired",
                visualLanguage: "avant-garde framing, unusual camera composition, abstract color accents and graphic staging",
                renderingNotes: "bold negative space, stylized perspective, symbolic visual rhythm without readable on-screen text"
            },
            {
                name: "Studio Trigger inspired",
                visualLanguage: "explosive cartoony energy, punchy neon palette, exaggerated dynamic posing",
                renderingNotes: "high-impact silhouettes, kinetic motion feeling, expressive deformation while keeping readability"
            }
        ]);
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

    private getPose() {
        return this.random([
            "facing the viewer, making eye contact",
            "3/4 view, slightly turned to the side with face clearly visible",
            "sitting and looking down thoughtfully",
            "walking toward the viewer",
            "close-up portrait, expressive face",
            "mid-shot, body slightly angled, expressive hands visible",
            "looking up at the sky with visible face",
            "leaning against a wall, visible expression"
        ]);
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
                "laughing while running across city lights"
            ],
            confiancadominante: [
                "walking with steady posture through downtown",
                "standing with confident posture in a busy avenue",
                "standing on a balcony with assertive calm"
            ],
            rockeletrizante: [
                "jumping with explosive body rhythm in the street",
                "skating fast through neon streets",
                "running through a crowded avenue with dynamic energy"
            ],
            tensaocriativa: [
                "writing intense notes in a small room",
                "arranging photos and papers with focused urgency",
                "pacing with restrained but rising tension"
            ],
            amorcalmo: [
                "sharing a quiet drink in a cozy place",
                "walking side by side under warm night lights",
                "holding hands while talking softly"
            ],
            conexaoafetiva: [
                "chatting closely with a friend in a cafe",
                "smiling while exchanging headphones with someone",
                "toasting gently with warm eye contact"
            ],
            nostalgiafeliz: [
                "holding an old photo while smiling softly",
                "watching old memories on a phone by the window",
                "watching city lights with a warm drink in hand"
            ],
            serenidade: [
                "sipping tea by a calm window",
                "reading quietly in a bright cafe corner",
                "walking slowly in a peaceful park"
            ],
            pazinterior: [
                "meditating in a minimalist room",
                "journaling in silence with soft morning light",
                "resting with eyes closed in complete quiet"
            ],
            contemplacao: [
                "staring at the horizon in deep thought",
                "sitting by the window reflecting in silence",
                "observing rain patterns on the glass"
            ],
            tensaodramatica: [
                "walking quickly through wet streets at night",
                "waiting at a station with visible anxiety",
                "standing under neon lights with restless posture"
            ],
            frustracao: [
                "crossing arms outside a bar with a tense face",
                "staring at unfinished notes in irritation",
                "pacing in a room with restrained annoyance"
            ],
            irritacaoativa: [
                "kicking a pebble while moving through downtown",
                "smoking with sharp gestures under streetlights",
                "moving with abrupt gestures through a narrow corridor"
            ],
            raivaexplosiva: [
                "shouting in an empty street with explosive force",
                "hitting a wall with open hand in frustration",
                "moving forward with intense confrontational energy"
            ],
            nostalgiaprofunda: [
                "sitting alone with a glass, lost in memory",
                "holding a worn letter by dim window light",
                "staring at old photos in an empty room"
            ],
            desanimo: [
                "sitting still on a sofa, gaze lowered",
                "walking slowly with heavy shoulders",
                "staring at a cold drink without reacting"
            ],
            vulnerabilidadeemocional: [
                "sitting on the floor in quiet emotional release",
                "holding a warm cup with trembling hands",
                "leaning against a wall with fragile posture"
            ],
            ambivalencia: [
                "hesitating between two paths on a street corner",
                "switching between notes with indecisive gestures",
                "staring at reflections with conflicted body language"
            ],
            estupor: [
                "sitting motionless on a late-night train",
                "holding an unlit cigarette while staring ahead",
                "standing still in a crowded street, detached"
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
                "dancing in the street under neon lights"
            ],
            positive: [
                "leaning on a balcony with a warm smile",
                "drinking a coffee while smiling at the city",
                "chatting with friends while holding a drink",
                "walking with headphones and relaxed posture"
            ],
            energetic: [
                "smoking near a neon-lit alley with intense expression",
                "walking quickly through a crowded avenue",
                "drinking at a street bar with cinematic lighting",
                "walking fast through rainy streets with headphones"
            ],
            melancholic: [
                "smoking by the window while rain falls outside",
                "sitting alone with a glass in a dim bar",
                "staring through a rainy window in an empty room",
                "holding a warm drink while staring into the distance"
            ],
            calm: [
                "sipping tea in a quiet room",
                "sitting quietly in a peaceful corner",
                "reading by the window with a warm drink",
                "resting on a sofa with headphones on"
            ],
            balanced: [
                "walking slowly through the city at golden hour",
                "sitting in a cafe with a drink and headphones",
                "sitting in a park during sunset",
                "leaning on a balcony, observing the skyline"
            ]
        };

        return this.random(actionMap[intensity] || actionMap["balanced"]);
    }

    private getUniverse(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentUniverse: Record<string, string[]> = {
            euforiaativa: ["festival street at night", "city rooftop with bright skyline", "busy downtown district full of motion"],
            confiancadominante: ["downtown avenue at blue hour", "modern rooftop terrace", "stylish urban block"],
            rockeletrizante: ["neon avenue", "industrial block", "city underpass with dynamic lighting"],
            tensaocriativa: ["small apartment workspace", "narrow corridor", "night alley with neon reflections"],
            amorcalmo: ["cozy cafe interior", "warm apartment balcony", "riverside walk with soft lights"],
            conexaoafetiva: ["friendly neighborhood cafe", "sunset promenade", "intimate living room"],
            nostalgiafeliz: ["old neighborhood street", "bedroom with old posters and photos", "sunset bus window view"],
            serenidade: ["quiet urban park", "sunlit apartment living room", "peaceful morning cafe"],
            pazinterior: ["minimalist apartment", "silent early-morning tram", "calm room with diffuse light"],
            contemplacao: ["window facing rainy skyline", "rooftop at dawn", "quiet riverside bench"],
            tensaodramatica: ["late-night subway platform", "wet downtown crosswalk", "gas station at night"],
            frustracao: ["street bar corner", "apartment stairwell", "narrow garage corridor"],
            irritacaoativa: ["boxing gym corridor", "night sidewalk under sodium lights", "crowded urban crossing"],
            raivaexplosiva: ["industrial block at midnight", "stormy city backstreet", "empty parking structure"],
            nostalgiaprofunda: ["empty bar interior", "small room with rainy window", "dim bedroom with old objects"],
            desanimo: ["late-night train carriage", "empty apartment kitchen", "city overpass at dawn"],
            vulnerabilidadeemocional: ["apartment bathroom", "quiet bedroom corner", "window seat during rain"],
            ambivalencia: ["subway transfer tunnel", "night convenience store frontage", "empty parking lot at dusk"],
            estupor: ["office rooftop alone", "nearly empty street before dawn", "silent tram platform"],

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
            euphoric: ["urban rooftop", "festival street", "crowded downtown district"],
            positive: ["cozy cafe", "city park", "sunlit neighborhood streets"],
            energetic: ["downtown at night", "industrial corridor", "neon avenue"],
            melancholic: ["rainy apartment window", "late-night bar", "empty street after midnight"],
            calm: ["minimalist room", "quiet cafe interior", "early morning city tram"],
            balanced: ["contemporary city neighborhood", "apartment interior", "urban riverside promenade"],
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

    // ---------------- UTIL ----------------
    private random<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}