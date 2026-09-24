import { Injectable } from '@nestjs/common';
import { TypeSafeClient, type Questions, type ChoiceResponse, type ScoreResponse, type NoulResponse, type JsonValue } from "@typesafe-ai/sdk";
import { Track } from '@prisma/client';
import { CoreAxes, EMOTION_CLUSTERS, EMOTIONAL_DIMENSIONS, EmotionalVector, EmotionAnalysisService } from './emotion-analysis.service';
import { TrackEnrichmentService } from './track-enrichment.service';

export type ResponseAi = {
  moodScore: number;
  dominantSentiment: string;
  emotionalVector: EmotionalVector;
  reasoning: string;

  coreAxes: CoreAxes;
  image_mood: string
  mostListenedSubgenre?: string;
  mostListenedSong?: {
    name: string;
    artist: string;
    img_url: string;
  };
  tracks: {
    id: string;
    music: string;
    artist: string;
    img_url: string;
    emotionalVector: EmotionalVector;
    dominantSentiment: string;
    reasoning: string;
    moodScore: number;
    genre: string;
    subgenre: string;
    coreAxes: CoreAxes;
  }[];
};

export type JourneyRequestInterpretation = {
  isMusic: boolean;
  to: string; // sentimento em que a playlist deve deixar o usuário
  statedFrom: string | null; // como o usuário diz que está, se o pedido disser
  guessedFrom: string; // palpite do Jev quando o pedido não diz
  hasStyle: boolean; // o pedido diz QUE música tocar (artista, gênero, época, estilo)?
  genre: string | null; // gênero citado, se o Jev reconhecer um da lista de subgêneros
};

type Dimension = typeof EMOTIONAL_DIMENSIONS[number];

// ---------------------------------------------------------------------------
// Rubricas das 10 dimensões (Score do Jev, 5 níveis: 0..4 → normalizado 0..1)
// ---------------------------------------------------------------------------
const DIMENSION_RUBRICS: Record<Dimension, { instructions: string; criteria: [string, string, string, string, string] }> = {
  Valencia: {
    instructions: "How positive is the emotional tone of this song?",
    criteria: [
      "Existential despair, hatred (e.g. 'Mad World')",
      "Mostly sad or bitter",
      "Real ambiguity, mixed feelings (e.g. 'Mr. Brightside')",
      "Hopeful, peaceful (e.g. 'Redemption Song')",
      "Pure, unshakable joy (e.g. 'Happy')",
    ],
  },
  Energia: {
    instructions: "How energetic and sonically intense is this song?",
    criteria: [
      "Near-silent minimalism, BPM below 60",
      "Slow and soft",
      "Mid-tempo pop, rock ballad",
      "Upbeat and driving",
      "Metal, EDM, punk; BPM above 160, maximum intensity",
    ],
  },
  Dominancia: {
    instructions: "How dominant, assertive or commanding is the song's stance?",
    criteria: [
      "Pleading, fragile, submissive",
      "Soft-spoken, yielding",
      "Neutral stance",
      "Assertive, self-assured",
      "Aggressive, authoritative, commanding (e.g. 'Eye of the Tiger')",
    ],
  },
  Melancolia: {
    instructions: "How much sadness, longing or saudade does this song carry?",
    criteria: [
      "No trace of sadness (e.g. 'Happy')",
      "Slight wistfulness",
      "Soft nostalgia, reflecting on the past",
      "Clear sadness or longing",
      "Grief, irreparable loss, consuming saudade (e.g. 'The Sound of Silence')",
    ],
  },
  Euforia: {
    instructions: "How euphoric or celebratory is this song?",
    criteria: [
      "Apathy, indifference, deep introspection",
      "Subdued",
      "Some lift, mild excitement",
      "Exciting, celebratory",
      "Ecstasy, manic celebration, emotional peak (e.g. 'Happy')",
    ],
  },
  Tensao: {
    instructions: "How much tension, anxiety or unresolved conflict does this song convey?",
    criteria: [
      "Total relaxation, resolved harmony",
      "Mostly calm",
      "Some unease",
      "Clear tension or anxiety",
      "Unresolved dissonance, anxiety, conflict (e.g. 'Smells Like Teen Spirit')",
    ],
  },
  ConexaoSocial: {
    instructions: "How much does this song express collective belonging, togetherness or connection with others?",
    criteria: [
      "Absolute isolation, inner monologue",
      "Mostly solitary",
      "Some connection with others",
      "About relationships or community",
      "Collective anthem, 'we', belonging (e.g. 'Happy')",
    ],
  },
  Introspeccao: {
    instructions: "How introspective or reflective are the lyrics?",
    criteria: [
      "Party lyrics, superficial, no reflection",
      "Light, mostly surface-level",
      "Some reflection",
      "Personal and reflective",
      "Existential philosophy, intimate secrets, diary-like (e.g. 'The Sound of Silence')",
    ],
  },
  Empoderamento: {
    instructions: "How empowering is this song?",
    criteria: [
      "Defeat, victimhood",
      "Resigned",
      "Neutral",
      "Encouraging, confident",
      "Overcoming, liberation, unshakable self-confidence (e.g. 'Eye of the Tiger')",
    ],
  },
  Vulnerabilidade: {
    instructions: "How emotionally vulnerable or exposed is this song?",
    criteria: [
      "Emotional armor, coldness, distance",
      "Guarded",
      "Some openness",
      "Openly emotional",
      "Exposed wounds, raw intimacy, crying (e.g. 'Mad World')",
    ],
  },
};

// ---------------------------------------------------------------------------
// Sentimento dominante (Choice do Jev) — rótulos iguais aos clusters 10D.
// ---------------------------------------------------------------------------
const SENTIMENT_CRITERIA: Record<string, string> = {
  Euforia: "Ecstatic, high-energy euphoria, peak excitement",
  Celebracao: "Joyful celebration with others, party, togetherness",
  Confianca: "Confidence, swagger, self-assurance, empowerment",
  Energia: "Raw drive and intensity without a strong positive or negative tone",
  Amor: "Romantic love, affection, tenderness",
  Paz: "Calm, serene, peaceful contentment",
  Reflexao: "Thoughtful reflection, contemplation",
  Tensao: "Anxiety, suspense, unresolved tension",
  Revolta: "Anger, rebellion, protest, aggression",
  Frustracao: "Frustration, bitterness, disappointment",
  Melancolia: "Melancholy, nostalgia, saudade",
  Tristeza: "Deep sadness, grief, heartbreak",
  Vazio: "Emptiness, numbness, apathy",
  Ambivalente: "Mixed or neutral feelings with no clear emotional identity",
};

// ---------------------------------------------------------------------------
// Subgênero (Choice do Jev) → gênero derivado. Uma única pergunta resolve os dois.
// ---------------------------------------------------------------------------
const SUBGENRE_TO_GENRE: Record<string, string> = {
  "Pop": "Pop",
  "Dance Pop": "Pop",
  "Indie Pop": "Pop",
  "Synth-pop": "Pop",
  "K-Pop": "Pop",
  "Rock Alternativo": "Rock",
  "Classic Rock": "Rock",
  "Hard Rock": "Rock",
  "Indie Rock": "Rock",
  "Punk Rock": "Rock",
  "Grunge": "Rock",
  "Rock Nacional": "Rock",
  "Heavy Metal": "Metal",
  "Metalcore": "Metal",
  "Rap": "Hip Hop",
  "Trap": "Hip Hop",
  "Drill": "Hip Hop",
  "Boom Bap": "Hip Hop",
  "Rap Nacional": "Hip Hop",
  "Trap BR": "Hip Hop",
  "R&B": "R&B/Soul",
  "Soul": "R&B/Soul",
  "Neo Soul": "R&B/Soul",
  "House": "Eletrônica",
  "Techno": "Eletrônica",
  "EDM": "Eletrônica",
  "Drum and Bass": "Eletrônica",
  "Lo-fi": "Eletrônica",
  "Funk Carioca": "Funk",
  "Brega Funk": "Funk",
  "Sertanejo Universitário": "Sertanejo",
  "Sertanejo Raiz": "Sertanejo",
  "Pagode": "Samba/Pagode",
  "Samba": "Samba/Pagode",
  "MPB": "MPB",
  "Bossa Nova": "MPB",
  "Forró": "Forró",
  "Piseiro": "Forró",
  "Axé": "Axé",
  "Arrocha": "Arrocha",
  "Gospel": "Gospel",
  "Reggaeton": "Latina",
  "Latin Pop": "Latina",
  "Reggae": "Reggae",
  "Jazz": "Jazz",
  "Blues": "Blues",
  "Country": "Country",
  "Folk": "Folk",
  "Indie Folk": "Folk",
  "Clássica": "Clássica",
  "Trilha Sonora": "Trilha Sonora",
};

const LEVELS = 4; // índice máximo dos rubrics de 5 níveis

@Injectable()
export class AiTextService {
  private jev: TypeSafeClient;

  constructor(
    private readonly emotionAnalysis: EmotionAnalysisService,
    private readonly enrichment: TrackEnrichmentService,
  ) {
    this.jev = new TypeSafeClient({
      apiKey: process.env.JEV_API_KEY ?? process.env.TYPESAFE_API_KEY,
      defaultModel: "jev-latest",
    });
  }

  private buildQuestions(): Questions {
    const questions: Questions = {
      sentiment: {
        type: "choice",
        instructions: "Which emotion best defines the overall mood of this song (lyrics and instrumentation)?",
        criteria: Object.fromEntries(EMOTION_CLUSTERS.map(label => [label, SENTIMENT_CRITERIA[label] ?? null])),
      },
      subgenre: {
        type: "choice",
        instructions: "Which subgenre best describes this song?",
        criteria: Object.fromEntries(Object.keys(SUBGENRE_TO_GENRE).map(sg => [sg, null])),
      },
    };

    for (const dimension of EMOTIONAL_DIMENSIONS) {
      const rubric = DIMENSION_RUBRICS[dimension];
      questions[dimension] = {
        type: "score",
        instructions: rubric.instructions,
        criteria: rubric.criteria,
      };
    }

    return questions;
  }

  private buildReasoning(vector: EmotionalVector, sentimentConfidence: number): string {
    const salient = [...EMOTIONAL_DIMENSIONS]
      .map(d => ({ d, v: vector[d], distance: Math.abs(vector[d] - 0.5) }))
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 3)
      .map(({ d, v }) => `${d} ${v >= 0.5 ? 'alta' : 'baixa'}`);

    return `Jev: ${salient.join(', ')} (confiança ${sentimentConfidence.toFixed(2)})`;
  }

  async analyzeTrack(
    track: Pick<Track, 'id' | 'title' | 'artist' | 'album' | 'img_url' | 'isrc' | 'explicit' | 'releaseDate'>,
    options: { skipMusicBrainz?: boolean } = {},
  ) {
    const { artistGenres, bpm } = await this.enrichment.enrich(track, options);

    // Só manda ao Jev o que existe: campo ausente não vira null/"desconhecido".
    const song = Object.fromEntries(Object.entries({
      title: track.title,
      artist: track.artist,
      album: track.album || undefined,
      release_year: track.releaseDate ? Number(track.releaseDate.slice(0, 4)) : undefined,
      explicit_lyrics: track.explicit ?? undefined,
      artist_genres: artistGenres.length ? artistGenres : undefined,
      bpm: bpm ?? undefined,
    }).filter(([, value]) => value !== undefined)) as Record<string, JsonValue>;

    const { answers } = await this.jev.systemOne({
      state: { song },
      questions: this.buildQuestions(),
    });

    const emotionalVector = Object.fromEntries(
      EMOTIONAL_DIMENSIONS.map(d => [d, (answers[d] as ScoreResponse).score / LEVELS])
    ) as EmotionalVector;

    const sentiment = answers.sentiment as ChoiceResponse;
    const subgenre = (answers.subgenre as ChoiceResponse).choice;

    const { coreAxes, dominantSentiment, moodScore } =
      this.emotionAnalysis.classifyFromProbabilities(emotionalVector, sentiment.probabilities);

    return {
      id: track.id,
      music: track.title,
      artist: track.artist,
      img_url: track.img_url ?? '',
      emotionalVector,
      dominantSentiment,
      reasoning: this.buildReasoning(emotionalVector, sentiment.confidence),
      moodScore,
      genre: SUBGENRE_TO_GENRE[subgenre] ?? "Unknown",
      subgenre,
      coreAxes,
      sentimentProbabilities: sentiment.probabilities,
    };
  }

  private average(records: Record<string, number>[]): Record<string, number> {
    const sums: Record<string, number> = {};
    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        sums[key] = (sums[key] ?? 0) + value;
      }
    }
    return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / records.length]));
  }

  // ---------------------------------------------------------------------------
  // Pedido livre do usuário na playlist de jornada ("bossa nova", "Coldplay"...)
  // ---------------------------------------------------------------------------

  // Um pedido livre ("to com raiva e quero me acalmar", "bossa nova") vira jornada:
  // é música? para qual sentimento levar? o usuário disse como está agora?
  async interpretJourneyRequest(request: string): Promise<JourneyRequestInterpretation> {
    const feelings = Object.fromEntries(EMOTION_CLUSTERS.map(label => [label, SENTIMENT_CRITERIA[label] ?? null]));
    const { answers } = await this.jev.systemOne({
      state: { request },
      questions: {
        verdict: {
          type: "choice",
          instructions: "Is `request` a request for music (artist, genre, era, style, mood or activity)?",
          criteria: {
            music: "A request for music, possibly mentioning how the user feels or what they want to feel",
            not_music: "Not about music: random text, unrelated question or instruction, or offensive content",
          },
        },
        to: {
          type: "choice",
          instructions: "Which feeling should a playlist for `request` leave the listener in at the end? Consider both the music asked for and any goal the user states.",
          criteria: feelings,
        },
        from_stated: { type: "noul", instructions: "Does `request` say how the user feels right now?" },
        has_style: {
          type: "noul",
          instructions: "Does `request` say what kind of music to play: a specific artist, band, genre, era or musical style? Feelings, moods, goals or activities alone do not count.",
        },
        genre: {
          type: "choice",
          instructions: "Which music genre does `request` explicitly ask for?",
          criteria: {
            ...Object.fromEntries(Object.keys(SUBGENRE_TO_GENRE).map(sg => [sg, null])),
            none: "No genre is named (only an artist, an era, feelings or an activity)",
          },
        },
        from: { type: "choice", instructions: "How does the user feel right now, according to `request`?", criteria: feelings },
      },
    });

    const from = (answers.from as ChoiceResponse).choice;
    return {
      isMusic: (answers.verdict as ChoiceResponse).choice === "music",
      to: (answers.to as ChoiceResponse).choice,
      statedFrom: (answers.from_stated as NoulResponse).noul >= 0.5 ? from : null,
      guessedFrom: from,
      hasStyle: (answers.has_style as NoulResponse).noul >= 0.5,
      genre: this.confidentGenre(answers.genre as ChoiceResponse),
    };
  }

  private confidentGenre(answer: ChoiceResponse): string | null {
    const probability = answer.probabilities[answer.choice] ?? 0;
    return answer.choice !== "none" && probability >= 0.5 ? answer.choice : null;
  }

  // Probabilidade (0..1) de cada música combinar com o pedido. Uma pergunta Noul
  // por música, várias por chamada (o Jev avalia todas em paralelo).
  async matchSongsToRequest(request: string, songs: { id: string; title: string; artist: string }[]): Promise<Map<string, number>> {
    const PER_CALL = 50;
    const scores = new Map<string, number>();

    const chunks = Array.from({ length: Math.ceil(songs.length / PER_CALL) }, (_, i) => songs.slice(i * PER_CALL, (i + 1) * PER_CALL));
    await Promise.all(chunks.map(async (chunk) => {
      const state = Object.fromEntries(chunk.map((song, i) => [`s${i}`, `${song.title} - ${song.artist}`]));
      const questions: Questions = Object.fromEntries(chunk.map((_, i) => [
        `s${i}`,
        {
          type: "noul",
          instructions: `Does the song \`songs.s${i}\` fit the kind of music asked for in \`request\` (artist, band, genre, era or style)? Ignore any feelings or goals mentioned in the request.`,
        },
      ]));

      const { answers } = await this.jev.systemOne({ state: { request, songs: state }, questions });
      chunk.forEach((song, i) => scores.set(song.id, (answers[`s${i}`] as NoulResponse).noul));
    }));

    return scores;
  }

  // Sentimento que mais se repete entre as faixas; empate decidido pela probabilidade média do Jev.
  private mostFrequentSentiment(sentiments: string[], averageProbabilities: Record<string, number>): string {
    const counts = new Map<string, number>();
    for (const s of sentiments) counts.set(s, (counts.get(s) ?? 0) + 1);

    return [...counts.entries()].sort(([a, countA], [b, countB]) =>
      countB - countA || (averageProbabilities[b] ?? 0) - (averageProbabilities[a] ?? 0)
    )[0][0];
  }

  async analyzeMusicMoodByHistoryToday(musics: Track[]): Promise<ResponseAi> {
    // Cada faixa é uma chamada ao Jev (as 12 perguntas são avaliadas em paralelo no servidor).
    const results = await Promise.allSettled(musics.map(m => this.analyzeTrack(m)));

    const analyzed = results.flatMap((result, i) => {
      if (result.status === 'fulfilled') return [result.value];
      console.error(`Erro ao classificar com o Jev (${musics[i].title} - ${musics[i].artist}):`, result.reason);
      return [];
    });

    if (!analyzed.length) {
      const fallbackVector = this.emotionAnalysis.buildFallbackVector();
      const fallbackEmotion = this.emotionAnalysis.classifyEmotion(fallbackVector);

      return {
        moodScore: fallbackEmotion.moodScore,
        dominantSentiment: fallbackEmotion.dominantSentiment,
        emotionalVector: fallbackVector,
        coreAxes: fallbackEmotion.coreAxes,
        reasoning: '',
        image_mood: '',
        tracks: [],
      };
    }

    const overallVector = this.average(analyzed.map(t => t.emotionalVector)) as EmotionalVector;
    const averageProbabilities = this.average(analyzed.map(t => t.sentimentProbabilities));
    const overallEmotion = this.emotionAnalysis.classifyFromProbabilities(overallVector, averageProbabilities);

    return {
      moodScore: overallEmotion.moodScore,
      dominantSentiment: this.mostFrequentSentiment(analyzed.map(t => t.dominantSentiment), averageProbabilities),
      emotionalVector: overallVector,
      reasoning: `Classificado pelo Jev com base em ${analyzed.length} faixa(s)`,
      image_mood: '',
      coreAxes: overallEmotion.coreAxes,
      tracks: analyzed.map(({ sentimentProbabilities, ...track }) => track),
    };
  }
}
