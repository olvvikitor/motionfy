import { Injectable } from "@nestjs/common";

type Genero = "male" | "female" | "neutral";

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

        return `
Create a high-quality artistic image in a Studio Ghibli-inspired style that represents the emotional theme "${data.sentiment}".

The image should visually express the feeling through colors, lighting, atmosphere, and character presence.

Style: Studio Ghibli-inspired, hand-painted anime
Mood style: ${moodStyle}
Lighting: ${visual.lighting}
Color palette: ${visual.colors}
- Camera: ${camera}
- Pose: ${pose}
- Framing: ${framing}

Emotional direction:
- ${emotionLayer}

Elements to consider:
- Environment: ${visual.scene}
- Main character: ${characterBase}, ${visual.character}
- Character archetype: ${archetype}

Character requirements:
- The main character MUST be ${this.resolveGenero(data.genero)}
- Avoid gender ambiguity unless specified

Avoid: realistic photography, hyper-realism, low quality, blurry, distorted faces, extra limbs, text, watermark

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
                    "a peaceful park with surreal floating details"
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
                    "floating islands in a vast sky",
                    "a surreal open world full of motion"
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
                    "minimalist indoor space",
                    "still nature environment"
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
            "a young man with expressive eyes",
            "a boy wearing headphones in an urban outfit",
            "a man with messy hair and a thoughtful look"
        ];

        const female = [
            "a young woman with soft flowing hair",
            "a girl with a light dress moving with the wind",
            "a woman with a calm and expressive gaze"
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
    private getPose() {
        return this.random([
            "facing the viewer, making eye contact",
            "3/4 view, slightly turned to the side",
            "side profile, looking into the distance",
            "sitting and looking down thoughtfully",
            "walking toward the viewer",
            "close-up portrait, expressive face",
            "mid-shot, body slightly angled, natural pose",
            "looking up at the sky with visible face",
            "leaning against a wall, visible expression"
        ]);
    }
    private getCamera() {
        return this.random([
            "close-up shot",
            "medium shot",
            "wide cinematic shot",
            "over-the-shoulder perspective",
            "low angle shot",
            "eye-level shot",
            "slightly tilted cinematic angle"
        ]);
    }
    private getFramingRule() {
        return this.random([
            "the character's face must be clearly visible",
            "avoid back-facing pose",
            "focus on facial expression and emotion",
            "the character should not be turned away from the viewer"
        ]);
    }

    // ---------------- UTIL ----------------
    private random<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}