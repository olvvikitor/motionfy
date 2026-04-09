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

const STUDIO_STYLES: StudioStyle[] = [
    {
        id: "kyoani",
        name: "Kyoto Animation inspired (KyoAni)",
        company: "Kyoto Animation",
        logoKey: "kyoani",
        referenceAnimes: ["Violet Evergarden", "K-On!", "Hyouka"],
        visualLanguage: `soft diffused lighting, pastel color palette, glossy expressive eyes, highly detailed facial micro-expressions, clean and polished character rendering, slice-of-life realism with emotional subtlety`,
        cinematography: `stable framing, natural camera behavior, intimate close-ups, focus on character acting rather than spectacle`,
        motionStyle: `extremely fluid animation, subtle gestures (eye movement, breathing, hair sway), high frame consistency and realism`,
        renderingNotes: `meticulous detail in anatomy and fabric, realistic lighting interaction, rich everyday environments with depth and softness`
    },
    {
        id: "ghibli",
        name: "Studio Ghibli inspired",
        company: "Studio Ghibli",
        logoKey: "ghibli",
        referenceAnimes: ["Spirited Away", "Howl's Moving Castle", "My Neighbor Totoro"],
        visualLanguage: `hand-painted watercolor backgrounds, organic textures, natural color harmony, simple but deeply expressive character designs, nostalgic and dreamlike tone`,
        cinematography: `wide scenic shots, environmental storytelling, slow contemplative pacing, focus on atmosphere and world immersion`,
        motionStyle: `weighty and natural movement, grounded physics even in fantasy, calm and deliberate animation timing`,
        renderingNotes: `visible brush strokes, traditional cel animation feel, strong connection between characters and nature`
    },
    {
        id: "ufotable",
        name: "Ufotable inspired",
        company: "ufotable",
        logoKey: "ufotable",
        referenceAnimes: ["Fate/stay night UBW", "Demon Slayer", "Kara no Kyoukai"],
        visualLanguage: `cinematic lighting, high contrast visuals, glowing highlights, heavy use of particle effects (embers, smoke, sparks), digital compositing with depth-of-field`,
        cinematography: `dynamic camera movement, sweeping angles, 3D-assisted tracking shots, cinematic framing similar to live-action films`,
        motionStyle: `smooth but impactful animation, dramatic anticipation and release, action sequences with layered effects and timing precision`,
        renderingNotes: `polished compositing between character and VFX, volumetric lighting, strong atmosphere and depth layering`
    },
    {
        id: "mappa",
        name: "Studio MAPPA inspired",
        company: "MAPPA",
        logoKey: "mappa",
        referenceAnimes: ["Jujutsu Kaisen", "Chainsaw Man", "Attack on Titan Final Season"],
        visualLanguage: `cinematic contrast, gritty urban texture, expressive linework, intense facial emotion, grounded anatomy with dramatic impact`,
        cinematography: `dynamic but controlled camera language, strong silhouettes, action-first staging with moody atmospheric depth`,
        motionStyle: `weighty impactful movement, sharp key poses, high-tension action rhythm with readable choreography`,
        renderingNotes: `rich shadow design, textured backgrounds, dramatic color separation, grounded realism in anime form without photorealism`
    },
    {
        id: "shaft",
        name: "Studio Shaft inspired",
        company: "Shaft",
        logoKey: "shaft",
        referenceAnimes: ["Bakemonogatari", "Puella Magi Madoka Magica", "March Comes in Like a Lion"],
        visualLanguage: `avant-garde composition, bold color blocking, abstract backgrounds, minimalist or symbolic environments, strong graphic identity`,
        cinematography: `extreme camera angles, head tilts, rapid cuts, unusual framing with heavy negative space and visual rhythm`,
        motionStyle: `limited animation used stylistically, focus on composition and editing over fluid motion`,
        renderingNotes: `surreal staging, symbolic imagery, typography-like visual pacing (without readable text), experimental visual storytelling`
    },
    {
        id: "trigger",
        name: "Studio Trigger inspired",
        company: "Studio Trigger",
        logoKey: "trigger",
        referenceAnimes: ["Kill la Kill", "Little Witch Academia", "Cyberpunk Edgerunners"],
        visualLanguage: `bold linework, saturated vibrant colors, exaggerated proportions, cartoony and expressive character design`,
        cinematography: `fast cuts, extreme zooms, dynamic framing, high-energy visual storytelling`,
        motionStyle: `hyper-kinetic animation, smear frames, exaggerated movement, intentionally chaotic but readable action`,
        renderingNotes: `strong silhouettes, high contrast shapes, expressive deformation over realism`
    }
];

@Injectable()
export class ImagePromptService {

    build(data: HybridPromptInput) {
        const studio = this.getStudioStyle(data.studioId);
        const referenceAnime = this.getRandomReferenceAnime(studio);

        return `
Create a breathtaking stylized 2D anime illustration in the style of ${studio.name}, capturing the emotional theme "${data.sentiment}".

━━━━━━━━━━
STUDIO DIRECTION
━━━━━━━━━━
Studio DNA:
- Visual language: ${studio.visualLanguage}
- Cinematography: ${studio.cinematography}
- Motion style: ${studio.motionStyle}
- Rendering notes: ${studio.renderingNotes}
- Reference anime: ${referenceAnime}

━━━━━━━━━━
CHARACTER
━━━━━━━━━━
Face reference:
${data.faceReferencePath ?? "not provided"}
Instructions:
- If a face reference is provided, adapt their identity beautifully into the anime style without retaining photorealism.
- Must be a single young adult character.

━━━━━━━━━━
CREATIVE FREEDOM (IMAGINE 100%)
━━━━━━━━━━
- YOU HAVE FULL CREATIVE FREEDOM. 
- Disregard any previous constraints about composition, poses, futuristic logic, powers, camera look, or world boundaries.
- Let the music's mood and the emotional theme completely dictate the visual elements, abstractness, magical components, metaphors, environment, lighting, and action.
- Imagine freely and create a gorgeous, evocative anime masterpiece!

━━━━━━━━━━
OUTPUT
━━━━━━━━━━
- Aspect Ratio: 9:16 (Portrait)
- Format: Stylized 2D Anime Illustration. NEVER photorealistic.
- DO NOT INCLUDE TITLES OR FLOATING TEXT. No words, no typography, unless it naturally belongs in the environment (e.g., street signs, shop banners).
`.trim();
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

    private getRandomReferenceAnime(studio: StudioStyle): string {
        if (!studio.referenceAnimes.length) {
            return "original studio visual language";
        }

        return this.random(studio.referenceAnimes);
    }

    private random<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}