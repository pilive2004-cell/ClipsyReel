/**
 * AutomaticPatternSelector — bridges the ViralPatternLibrary module with the
 * REAL production rendering pipeline (`src/lib/video-engine.ts`).
 *
 * This runs automatically on every real render, with no user action
 * required: it picks the best-fit abstract montage pattern for the chosen
 * `ReelStyle` + detected best moments, then derives a small, safe nudge to
 * the existing per-style recipe (clip pacing + transition priority) so the
 * exported Reel's rhythm stays aligned with proven, currently-published
 * editing conventions (see `TrendInsights.ts`) — without ever touching or
 * downloading any third-party video content.
 *
 * Design constraints (deliberately conservative, to avoid destabilizing the
 * working render pipeline):
 * - Only ever *nudges* `StyleRecipe.clipDuration` within +/-12% of the
 *   style's existing value — never overrides `zoom`, `zoomIntensity`,
 *   `reelClipCount`, or `targetReelSeconds`.
 * - Only *reorders/filters* the style's own curated `TransitionPool.names`
 *   (already vetted for a premium look in `transitions.ts`) — never
 *   introduces a transition name outside that pool.
 * - Every export still automatically varies (different pattern/transition
 *   priority than the previous render for the same style), matching the
 *   "avoid repeating the exact same edit" requirement, via a small
 *   localStorage memory — the same technique already used by
 *   `selectEditingPattern` in `editingPatterns.ts`.
 */
import { BestMoment, EmotionalStoryTimeline, ReelStyle } from "@/types";
import { StyleRecipe } from "@/data/styleRecipes";
import { TransitionPool } from "@/data/transitions";
import { PatternMixer } from "./PatternMixer";
import { calculateMontageQualityScore } from "./MontageQualityScorer";
import { EnergyLevel, MontageRecipeInput, MontageStyleTag, TransitionType, VideoType } from "./types";

// Deliberately tuned so every style lands on a *genuinely* well-matching demo
// pattern (verified against `data/demoPatterns.ts`'s actual videoType/energy
// combos), not just "closest available" — see PatternLibrary.fitScore, whose
// videoType/energy match bonuses only help if at least one pattern actually
// satisfies both axes. `viral` in particular is mapped to `road_trip` rather
// than a more literal `city`, because no demo pattern combines `city` with
// `extreme` energy, whereas `road_trip` + `extreme` is a strong, confident
// match onto "Fast Adventure Hook" (fast cuts, single standout peak — exactly
// the scroll-stopping feel the Viral style is going for).
const STYLE_TO_VIDEO_TYPE: Record<ReelStyle, VideoType> = {
  viral: "road_trip",
  adventure: "motorcycle",
  cinematic: "road_trip",
  travel: "travel",
  sport: "offroad",
  luxury: "travel",
};

const STYLE_TO_ENERGY: Record<ReelStyle, EnergyLevel> = {
  viral: "extreme",
  adventure: "dynamic",
  cinematic: "balanced",
  travel: "balanced",
  sport: "extreme",
  luxury: "calm",
};

/** Maps the abstract ViralPatternLibrary transition vocabulary onto the
 * app's existing, already-curated ffmpeg xfade names — only ever returning
 * names that are already part of the style's own pool. Never references any
 * name on the global forbidden-transition list (`FORBIDDEN_TRANSITIONS` in
 * `transitions/xfadeMapping.ts`) — e.g. plain `dissolve` is replaced by the
 * equally "soft continuity blend" `fadegrays`. */
const ABSTRACT_TO_XFADE_HINTS: Record<TransitionType, string[]> = {
  direct_cut: [],
  crossfade: ["fadegrays", "fade"],
  motion_blur: ["zoomin"],
  whip_pan: ["zoomin"],
  zoom_transition: ["zoomin"],
  match_on_action: ["fadegrays"],
  object_wipe: ["fadegrays"],
  speed_ramp: ["zoomin"],
  flash_cut: ["fadeblack", "fadewhite"],
  hard_cut_on_beat: ["fadeblack"],
  map_transition: ["fadegrays"],
  drone_like_reveal: ["fade", "fadegrays"],
  pov_transition: ["zoomin"],
  loopable_end: ["fade"],
};

const NEAREST_DURATIONS: MontageRecipeInput["desiredDurationSeconds"][] = [15, 30, 45, 60];

function nearestDuration(seconds: number): MontageRecipeInput["desiredDurationSeconds"] {
  return NEAREST_DURATIONS.reduce((best, d) => (Math.abs(d - seconds) < Math.abs(best - seconds) ? d : best), NEAREST_DURATIONS[0]);
}

const STORAGE_KEY = "clipsyreel:lastPatternSignaturesByStyle";
const MAX_MEMORY = 5;

function readRecentSignatures(style: ReelStyle): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    return map[style] ?? [];
  } catch {
    return [];
  }
}

function writeRecentSignature(style: ReelStyle, signature: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const updated = [signature, ...(map[style] ?? [])].slice(0, MAX_MEMORY);
    map[style] = updated;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort only — losing this memory just means occasional repeats, not a functional problem.
  }
}

export interface AutomaticPatternAdjustment {
  /** Small, safe overrides to merge onto the style's `StyleRecipe` (spread over the original). */
  recipeOverride: Partial<Pick<StyleRecipe, "clipDuration">>;
  /** Reordered/filtered transition names (subset of the style's own pool) to prioritize, or `null` to keep default behavior. */
  transitionOverride: TransitionPool | null;
  /** Human-readable summary for the render's "applied effects" list. */
  summaryLine: string;
}

const STYLE_TO_MONTAGE_STYLE_TAG: Record<ReelStyle, MontageStyleTag> = {
  viral: "viral",
  adventure: "adventure",
  cinematic: "cinematic",
  travel: "emotional",
  // Not literally "viral" — avoids a confusing "Viral ..." recipe name
  // showing up for a render the user explicitly chose as "Sport".
  sport: "adventure",
  luxury: "premium",
};

/**
 * Computes an automatic, no-user-input pattern adjustment for this render.
 * Always safe to call — falls back to a neutral (no-op) adjustment if
 * anything about the pattern library is unavailable.
 */
export function selectAutomaticPatternAdjustment(input: {
  style: ReelStyle;
  bestMoments: BestMoment[];
  emotionalStory: EmotionalStoryTimeline | null;
  baseRecipe: StyleRecipe;
  baseTransitionPool: TransitionPool;
}): AutomaticPatternAdjustment {
  const { style, bestMoments, baseRecipe, baseTransitionPool } = input;

  try {
    const mixer = new PatternMixer();
    const recipeInput: MontageRecipeInput = {
      desiredDurationSeconds: nearestDuration((baseRecipe.targetReelSeconds[0] + baseRecipe.targetReelSeconds[1]) / 2),
      videoType: STYLE_TO_VIDEO_TYPE[style],
      desiredEnergy: STYLE_TO_ENERGY[style],
      format: "9:16",
      gpxAvailable: false,
      musicAvailable: true,
      bestMomentsCount: bestMoments.length,
      style: STYLE_TO_MONTAGE_STYLE_TAG[style],
    };

    const recentSignatures = readRecentSignatures(style);
    const mixResult = mixer.mix(recipeInput, { recentSignatures });
    writeRecentSignature(style, mixResult.recipe.editingSignature);

    const quality = calculateMontageQualityScore(mixResult.recipe, { coherenceScore: mixResult.coherenceScore });

    // Pacing nudge: derive a bounded scale factor from how much the pattern
    // accelerates into its climax (higher = punchier/faster cuts wanted).
    const climax = mixResult.recipe.timeline.find((s) => s.segmentType === "climax");
    const context = mixResult.recipe.timeline.find((s) => s.segmentType === "context");
    const energyDelta = climax && context ? climax.energy - context.energy : 0;
    const paceScale = clamp(1 - energyDelta / 800, 0.88, 1.12); // e.g. +40 energy delta -> ~5% shorter clips
    const clipDuration = Math.round(baseRecipe.clipDuration * paceScale * 100) / 100;

    // Transition priority: map the pattern's own transition sequence onto
    // the style's already-curated xfade names, keeping only ones that exist
    // in the base pool, in the pattern's preferred order.
    const preferredNames: string[] = [];
    mixResult.recipe.timeline.forEach((seg) => {
      ABSTRACT_TO_XFADE_HINTS[seg.transitionOut]?.forEach((name) => {
        if (baseTransitionPool.names.includes(name) && !preferredNames.includes(name)) preferredNames.push(name);
      });
    });
    baseTransitionPool.names.forEach((name) => {
      if (!preferredNames.includes(name)) preferredNames.push(name);
    });

    const transitionOverride: TransitionPool = { ...baseTransitionPool, names: preferredNames };

    return {
      recipeOverride: { clipDuration },
      transitionOverride,
      summaryLine: `Automatic pattern: ${mixResult.recipe.recipeName} (quality ${quality.overallScore}/100)`,
    };
  } catch {
    // Pattern selection is a pure enhancement — any failure here must never
    // block or alter the render, so we fall back to the untouched defaults.
    return { recipeOverride: {}, transitionOverride: null, summaryLine: "" };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
