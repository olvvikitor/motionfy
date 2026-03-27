import { Injectable } from "@nestjs/common";

type Genero = "male" | "female" | "neutral";

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
        genero?: Genero;
        emotions?: any; // vetor emocional
    }) {

        const intensidade = this.getIntensity(data.moodScore, data.ativacao);
        const visual = this.getVisual(intensidade);
        const characterBase = this.getCharacterProfile(data.genero);
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

Emotional direction:
- ${emotionLayer}

Expression & action priorities (highest priority):
- The face expression must clearly communicate the mood at first glance
- The selected action must be unambiguous and central in the frame
- Hands, eyes, and body gesture should reinforce the emotion
- Keep environment as context only, never as the main subject

Elements to consider:
- Environment: ${visual.scene} (${universe})
- Main character: ${characterBase}, ${visual.character}
- Character archetype: ${archetype}

Character requirements:
- The main character MUST be ${this.resolveGenero(data.genero)}
- The character should be portrayed as a young adult
- Avoid gender ambiguity unless specified
- Show clear facial details (eyes, eyebrows, mouth) with readable emotion
- Avoid tiny, distant, or silhouette-only characters

Avoid: realistic photography, hyper-realism, low quality, blurry, distorted faces, extra limbs, text, watermark
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

    // ---------------- PERSONAGEM ----------------
    private getCharacterProfile(genero?: Genero) {

        const male = [
            "a young adult man with expressive eyes",
            "a young adult man wearing headphones in an urban outfit",
            "a young adult man with messy hair and a thoughtful look"
        ];

        const female = [
            "a young adult woman with soft flowing hair",
            "a young adult woman with a light dress moving with the wind",
            "a young adult woman with a calm and expressive gaze"
        ];

        const neutral = [
            "an androgynous anime character",
            "a dreamy figure with ambiguous features"
        ];

        if (genero === "male") return this.random(male);
        if (genero === "female") return this.random(female);

        return this.random(neutral);
    }

    private resolveGenero(genero?: Genero) {
        if (genero === "male") return "clearly male";
        if (genero === "female") return "clearly female";
        return "gender-neutral";
    }

    // ---------------- ARQUÉTIPO ----------------
    private getArchetype() {
        return this.random([
            "dreamer",
            "wanderer",
            "artist",
            "loner",
            "explorer",
            "musician",
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
            "surtando": ["furious eyes, clenched jaw, explosive energy", "wide intense eyes, aggressive posture, visible tension"],
            "adrenalina pura": ["excited eyes, open smile, adrenaline in body language", "focused joyful expression with energetic movement"],
            "caos controlado": ["intense focused gaze, restless expression", "confident but edgy face, controlled tension"],
            "pressentindo": ["suspicious eyes, subtle anxiety in expression", "alert gaze with uneasy facial tension"],
            "de cara": ["frustrated expression, pressed lips, narrowed eyes", "annoyed face with visible emotional load"],
            "p da vida": ["angry eyebrows, tense jaw, confrontational stare", "irritated expression with sharp body gesture"],
            "apaixonadx": ["soft smile, warm eyes, affectionate expression", "romantic gaze with gentle facial softness"],
            "saudade boa": ["nostalgic half-smile, teary bright eyes", "tender expression mixing joy and longing"],
            "chorando no banheiro": ["watery eyes, fragile expression, emotional exhaustion", "sad face with visible vulnerability"],
            "de boa": ["relaxed smile, calm gaze, peaceful expression", "light and effortless expression"],
            "zerado": ["serene neutral face, slow breathing vibe", "meditative expression with gentle eyes"],
            "tô confuso": ["uncertain eyes, conflicted expression", "hesitant face with mixed emotion"],
            "travado": ["blank stare, emotionally numb expression", "detached eyes, minimal facial reaction"],
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
        return sentiment?.trim().toLowerCase() ?? "";
    }

    private getAction(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentActions: Record<string, string[]> = {
            "surtando": [
                "smoking outside a convenience store at night",
                "playing distorted electric guitar in a garage studio",
                "walking fast in the rain with a drink can in hand"
            ],
            "adrenalina pura": [
                "playing electric guitar on a rooftop at sunset",
                "singing loudly in a rehearsal room",
                "skating through downtown with headphones"
            ],
            "caos controlado": [
                "smoking while writing lyrics in a small studio",
                "drumming intensely in a rehearsal basement",
                "drinking coffee while editing tracks at night"
            ],
            "pressentindo": [
                "smoking near a neon-lit alley with a tense expression",
                "waiting at a late-night bus stop holding a drink",
                "walking alone through wet streets after midnight"
            ],
            "de cara": [
                "smoking outside a bar with crossed arms",
                "playing gritty guitar riffs in a dim room",
                "sitting silent at a counter with a half-full glass"
            ],
            "p da vida": [
                "kicking a pebble while walking through downtown",
                "smoking with an intense stare under streetlights",
                "playing aggressive guitar in a live house"
            ],
            "apaixonadx": [
                "sharing a drink in a cozy bar",
                "walking hand in hand through evening streets",
                "playing acoustic guitar for someone on a balcony"
            ],
            "saudade boa": [
                "holding an old photo with coffee on a kitchen table",
                "playing a nostalgic guitar melody in the bedroom",
                "watching city lights from the window with a warm drink"
            ],
            "chorando no banheiro": [
                "sitting on the bathroom floor after a night out",
                "smoking by the window while rain falls outside",
                "holding a glass at a dim bar, lost in thought"
            ],
            "de boa": [
                "sipping coffee by a window in the morning",
                "reading in a cafe while listening to music",
                "playing soft guitar on a quiet afternoon"
            ],
            "zerado": [
                "drinking tea in a minimalist room",
                "journaling at a quiet cafe table",
                "listening to vinyl while resting on the sofa"
            ],
            "tô confuso": [
                "standing in front of convenience store lights at night",
                "switching between guitar chords in a messy room",
                "staring at a half-finished drink in silence"
            ],
            "travado": [
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
                "playing an electric guitar on a rooftop",
                "jumping while singing with headphones on",
                "laughing while holding a drink can",
                "dancing in the street under neon lights"
            ],
            positive: [
                "strumming an acoustic guitar on a balcony",
                "drinking a coffee while smiling at the city",
                "chatting with friends while holding a drink",
                "walking with headphones and singing softly"
            ],
            energetic: [
                "smoking near a neon-lit alley with intense expression",
                "playing guitar in a small live house",
                "drinking at a street bar with cinematic lighting",
                "walking fast through rainy streets with headphones"
            ],
            melancholic: [
                "smoking by the window while rain falls outside",
                "sitting alone with a glass in a dim bar",
                "playing a slow guitar melody in an empty room",
                "holding a warm drink while staring into the distance"
            ],
            calm: [
                "sipping tea in a quiet room",
                "playing soft guitar in a peaceful corner",
                "reading by the window with a warm drink",
                "resting on a sofa with headphones on"
            ],
            balanced: [
                "walking slowly through the city at golden hour",
                "sitting in a cafe with a drink and headphones",
                "playing guitar in a park during sunset",
                "leaning on a balcony, observing the skyline"
            ]
        };

        return this.random(actionMap[intensity] || actionMap["balanced"]);
    }

    private getUniverse(sentiment: string, intensity: string) {
        const key = this.normalizeSentiment(sentiment);

        const sentimentUniverse: Record<string, string[]> = {
            "surtando": ["night downtown district", "underground live house", "rainy city blocks"],
            "adrenalina pura": ["concert rehearsal studio", "city rooftop at sunset", "busy urban avenue"],
            "caos controlado": ["home music studio", "industrial neighborhood at dusk", "small venue backstage"],
            "pressentindo": ["neon-lit side street", "late-night subway platform", "quiet gas station at night"],
            "de cara": ["street bar corner", "apartment stairwell", "night sidewalk under sodium lights"],
            "p da vida": ["downtown crosswalk", "boxing gym corridor", "garage rehearsal room"],
            "apaixonadx": ["cozy bar interior", "city promenade at night", "apartment balcony with warm lights"],
            "saudade boa": ["old neighborhood cafe", "bedroom with posters and records", "sunset bus window view"],
            "chorando no banheiro": ["apartment bathroom", "empty bar restroom", "small room with rainy window"],
            "de boa": ["quiet cafe", "urban park bench", "sunlit apartment living room"],
            "zerado": ["minimalist apartment", "bookstore cafe", "morning tram ride"],
            "tô confuso": ["night convenience store frontage", "subway transfer tunnel", "empty parking lot at dusk"],
            "travado": ["late-night train carriage", "office rooftop alone", "city overpass at dawn"],
        };

        if (sentimentUniverse[key]) {
            return this.random(sentimentUniverse[key]);
        }

        const intensityUniverse: Record<string, string[]> = {
            euphoric: ["urban rooftop", "festival street", "music venue district"],
            positive: ["cozy cafe", "city park", "sunlit neighborhood streets"],
            energetic: ["downtown at night", "rehearsal studio", "neon avenue"],
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