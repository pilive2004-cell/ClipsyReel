import {
  BestMoment,
  CaptionVariant,
  HookVariant,
  MusicSuggestion,
  Plan,
  ReelAnalysisResult,
  ReelStyle,
  StyleDefinition,
} from "@/types";

/**
 * All data in this file is mocked for the MVP.
 *
 * FUTURE BACKEND INTEGRATION:
 * - Replace `generateMockAnalysis()` with a real API call, e.g.
 *   `POST /api/analyze` that runs FFmpeg scene-detection + an ML/LLM model
 *   on the uploaded video and returns a `ReelAnalysisResult`.
 * - GPX route parsing is now real (see `src/lib/gpx.ts` + `GPXMap.tsx`,
 *   powered by `leaflet-gpx`); only per-video geolocation metadata is still
 *   mocked (see `src/lib/video-location-matcher.ts`).
 */

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "Try ClipsyReel, no card required",
    features: [
      "1 Reel per week",
      "Basic styles (Viral, Travel)",
      "720p export",
      "Hook + caption generator",
    ],
    lockedFeatures: [
      "No watermark removal",
      "No GPX route maps",
      "No premium styles",
      "No batch export",
    ],
  },
  {
    id: "creator",
    name: "Creator Pro",
    price: 9.99,
    tagline: "For creators who post every week",
    features: [
      "30 Reels per month",
      "No watermark",
      "HD (1080p) export",
      "All premium styles",
      "GPX route maps",
      "More hook & caption variants",
    ],
    highlight: true,
    badge: "Most popular",
  },
  {
    id: "business",
    name: "Business Pro",
    price: 19.99,
    tagline: "For teams and power creators",
    features: [
      "Unlimited Reels",
      "4K export",
      "Batch generation",
      "Advanced customization",
      "Saved projects",
      "Priority processing",
    ],
    badge: "Best value",
  },
];

export const STYLES: StyleDefinition[] = [
  {
    id: "viral",
    label: "Viral",
    description: "Fast cuts, bold captions, made to stop the scroll.",
    emoji: "⚡️",
    gradient: "from-fuchsia-500 to-orange-400",
  },
  {
    id: "travel",
    label: "Travel",
    description: "Warm, dreamy, wanderlust-driven storytelling.",
    emoji: "🌍",
    gradient: "from-sky-400 to-emerald-400",
  },
  {
    id: "adventure",
    label: "Adventure",
    description: "High energy, outdoors, adrenaline-first pacing.",
    emoji: "🏔️",
    gradient: "from-amber-500 to-red-500",
  },
  {
    id: "sport",
    label: "Sport",
    description: "Punchy rhythm built around action peaks.",
    emoji: "🏁",
    gradient: "from-lime-400 to-cyan-500",
    proOnly: true,
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Slow, moody, film-grade color and pacing.",
    emoji: "🎬",
    gradient: "from-indigo-500 to-slate-400",
    proOnly: true,
  },
  {
    id: "luxury",
    label: "Luxury",
    description: "Premium, minimal, high-end brand feel.",
    emoji: "💎",
    gradient: "from-yellow-400 to-neutral-300",
    proOnly: true,
  },
];

const HOOKS_BY_STYLE: Record<ReelStyle, string[]> = {
  viral: [
    "Wait for it... this changes everything.",
    "POV: you found the best spot before everyone else.",
    "The moment everything changed.",
  ],
  travel: [
    "This place shouldn't even be real.",
    "I almost didn't stop here. Biggest mistake avoided.",
    "Add this to your bucket list right now.",
  ],
  adventure: [
    "We had no idea what we were getting into.",
    "This is why we do it.",
    "The moment fear turned into pure adrenaline.",
  ],
  sport: [
    "Every second of training led to this moment.",
    "This is what it feels like to push your limit.",
    "Watch what happens at full speed.",
  ],
  cinematic: [
    "Some moments deserve to be remembered like this.",
    "A story told in silence and light.",
    "This is what freedom actually looks like.",
  ],
  luxury: [
    "Some experiences are simply built different.",
    "Precision. Power. Presence.",
    "This is what mastery looks like in motion.",
  ],
};

const CAPTIONS_BY_STYLE: Record<ReelStyle, string[]> = {
  viral: [
    "Okay but why did nobody tell me about this?! 😳 Tag someone who needs to see this.",
    "This might be the best 15 seconds on my feed this month. Save this for later 📌",
  ],
  travel: [
    "Some places just hit different 🌅 Where should I go next? Drop it below 👇",
    "Chasing golden hour across the world, one Reel at a time ✈️",
  ],
  adventure: [
    "Fear is temporary. This feeling isn't 🏔️ Who's coming next time?",
    "We almost turned back. So glad we didn't 🔥",
  ],
  sport: [
    "Consistency beats motivation. Every single time 🏁",
    "Full send. No regrets. Full stop.",
  ],
  cinematic: [
    "A quiet moment, captured before it disappeared.",
    "Some stories don't need words.",
  ],
  luxury: [
    "Excellence isn't an accident. It's a standard.",
    "Built for those who don't compromise.",
  ],
};

const HASHTAGS_BY_STYLE: Record<ReelStyle, string[]> = {
  viral: ["#viral", "#fyp", "#trending", "#reels", "#explorepage", "#viralreels"],
  travel: ["#travelreels", "#wanderlust", "#travelgram", "#hiddengem", "#bucketlist"],
  adventure: ["#adventuretime", "#outdoorlife", "#explore", "#adrenaline", "#wildernessculture"],
  sport: ["#athletelife", "#trainhard", "#sportreels", "#nolimits", "#pushyourlimits"],
  cinematic: ["#cinematic", "#filmmaking", "#storytelling", "#moodygrams", "#cinematography"],
  luxury: ["#luxurylifestyle", "#premium", "#luxurycars", "#exclusive", "#craftsmanship"],
};

const MUSIC_BY_STYLE: Record<ReelStyle, MusicSuggestion> = {
  viral: { genre: "Hyperpop / Trap", mood: "Energetic, punchy", bpm: 140, reference: "Similar to: viral TikTok trap edits" },
  travel: { genre: "Chill / Indie Pop", mood: "Dreamy, warm", bpm: 96, reference: "Similar to: lo-fi road trip beats" },
  adventure: { genre: "Cinematic Percussion", mood: "Epic, driving", bpm: 128, reference: "Similar to: expedition trailer scores" },
  sport: { genre: "Drum & Bass / EDM", mood: "Intense, fast", bpm: 150, reference: "Similar to: training montage anthems" },
  cinematic: { genre: "Ambient Orchestral", mood: "Emotional, slow-building", bpm: 72, reference: "Similar to: A24 film scores" },
  luxury: { genre: "Deep House / Minimal", mood: "Sleek, confident", bpm: 118, reference: "Similar to: fashion runway sets" },
};

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function secondsToLabel(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const MOMENT_REASONS = [
  "High motion + sharp focus detected",
  "Peak facial expression / emotional reaction",
  "Strong composition and lighting change",
  "Sudden speed or action spike",
  "Scene transition with high visual contrast",
  "Detected smile / celebratory gesture",
];

function generateMomentsForVideo(totalDuration: number, sourceIndex: number): BestMoment[] {
  const momentCount = Math.max(1, Math.min(4, Math.floor(totalDuration / 4)));
  let cursor = Math.min(totalDuration * 0.08, 2);
  const moments: BestMoment[] = [];
  for (let i = 0; i < momentCount; i++) {
    const remainingSlots = momentCount - i;
    const remainingSpace = Math.max(0.5, totalDuration - cursor);
    const length = Math.max(0.6, Math.min(remainingSpace / remainingSlots, 3 + Math.random() * 4));
    const start = Math.min(cursor, Math.max(0, totalDuration - length));
    const end = Math.min(totalDuration, start + length);
    moments.push({
      id: randomId("moment"),
      startSeconds: start,
      endSeconds: end,
      timestampLabel: `${secondsToLabel(start)} - ${secondsToLabel(end)}`,
      confidence: Math.round(72 + Math.random() * 26),
      reason: MOMENT_REASONS[(i + Math.floor(Math.random() * MOMENT_REASONS.length)) % MOMENT_REASONS.length],
      sourceIndex,
    });
    cursor = end + Math.max(0.4, (totalDuration - end) / (remainingSlots + 1));
  }
  return moments;
}

/**
 * Simulates a full AI video analysis pass.
 * In production this would be replaced by a real backend job that:
 * 1. Extracts frames via FFmpeg
 * 2. Scores frames/segments with a vision model
 * 3. Runs an LLM to produce hook/caption/hashtag text grounded in the video content
 */
export function generateMockAnalysis(videoName: string, style: ReelStyle, videoDurationSeconds?: number): ReelAnalysisResult {
  // Real video duration (read from the uploaded file) keeps best-moment
  // timestamps honest — otherwise a short clip could get "best moments"
  // that don't actually exist in the footage.
  const totalDuration = videoDurationSeconds && videoDurationSeconds > 1 ? videoDurationSeconds : 20;
  const bestMoments = generateMomentsForVideo(totalDuration, 0);

  const hooks: HookVariant[] = HOOKS_BY_STYLE[style].map((text) => ({ id: randomId("hook"), text }));
  const captions: CaptionVariant[] = CAPTIONS_BY_STYLE[style].map((text) => ({ id: randomId("caption"), text }));

  return {
    videoName,
    durationLabel: secondsToLabel(totalDuration),
    style,
    overallScore: Math.round(78 + Math.random() * 18),
    bestMoments,
    hooks,
    captions,
    hashtags: HASHTAGS_BY_STYLE[style],
    music: MUSIC_BY_STYLE[style],
  };
}

/**
 * Same as `generateMockAnalysis`, but for a montage combining up to 3 uploaded
 * videos: best moments are detected independently per source clip (each
 * tagged with `sourceIndex`) and merged into a single result.
 *
 * NOTE: this generates *random* placeholder moments and is only used as a
 * fallback if the real in-browser analysis (`src/lib/video-analysis.ts`)
 * fails for some reason (e.g. an unsupported codec). The normal path is
 * `buildAnalysisResult()` below, fed with real detected moments.
 */
export function generateMockAnalysisMulti(
  videos: { name: string; durationSeconds: number }[],
  style: ReelStyle
): ReelAnalysisResult {
  const bestMoments = videos.flatMap((v, i) => generateMomentsForVideo(Math.max(v.durationSeconds, 1), i));
  const totalDuration = videos.reduce((sum, v) => sum + v.durationSeconds, 0);
  const videoName = videos.length > 1 ? `${videos.length} videos combined` : videos[0]?.name ?? "video";
  return buildAnalysisResult(videoName, totalDuration, style, bestMoments);
}

/**
 * Composes the final `ReelAnalysisResult` from a set of *real, content-aware*
 * best moments (see `analyzeAllVideos` in `src/lib/video-analysis.ts`).
 * Hook/caption/hashtag/music copy is still style-based mock text (a real
 * backend would generate these with an LLM grounded in the actual footage),
 * but `bestMoments` and `overallScore` now reflect genuine per-frame
 * motion/sharpness/exposure scoring instead of random placeholders.
 */
export function buildAnalysisResult(
  videoName: string,
  totalDurationSeconds: number,
  style: ReelStyle,
  bestMoments: BestMoment[]
): ReelAnalysisResult {
  const hooks: HookVariant[] = HOOKS_BY_STYLE[style].map((text) => ({ id: randomId("hook"), text }));
  const captions: CaptionVariant[] = CAPTIONS_BY_STYLE[style].map((text) => ({ id: randomId("caption"), text }));

  // Overall "virality" score is derived from the real moment confidences
  // (average, nudged slightly) so it stays consistent with what was detected.
  const avgConfidence = bestMoments.length
    ? bestMoments.reduce((sum, m) => sum + m.confidence, 0) / bestMoments.length
    : 78;
  const overallScore = Math.round(Math.min(99, Math.max(55, avgConfidence + (Math.random() * 6 - 3))));

  return {
    videoName,
    durationLabel: secondsToLabel(totalDurationSeconds),
    style,
    overallScore,
    bestMoments,
    hooks,
    captions,
    hashtags: HASHTAGS_BY_STYLE[style],
    music: MUSIC_BY_STYLE[style],
  };
}

export const ANALYSIS_STEPS = [
  "Scanning frames for motion & sharpness…",
  "Detecting your best moments…",
  "Scoring emotional impact…",
  "Writing your hook & caption…",
  "Matching a music mood…",
  "Rendering your 9:16 Reel preview…",
];
