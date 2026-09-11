import { ReelStyle } from "@/types";
import { STYLE_PRESETS } from "@/styles";

/**
 * Editing "recipe" applied per style when building the real montage with
 * ffmpeg.wasm (see `src/lib/video-engine.ts`).
 *
 * These values drive:
 * - how long each detected best-moment clip is kept
 * - which xfade transition type ffmpeg uses between clips
 * - how strong / in which direction the Ken Burns zoom effect moves
 * - clip pacing / zoom energy
 *
 * `minClipDuration`/`maxClipDuration` are read straight from each style's
 * `StylePreset` (`src/styles/*.style.ts` — the same source of truth the
 * transition system uses), so a style's shot-length "personality" (Viral's
 * punchy 0.3-1.5s vs Luxury's patient 5-10s) is defined in exactly one
 * place instead of silently drifting between the render engine and the
 * transition rule system. `clipDuration` stays as the *average* target,
 * still used for reel-length/clip-count math below.
 *
 * FUTURE: these could become user-tunable ("editing intensity" slider) or be
 * chosen automatically by a real ML model based on the footage content.
 *
 * `targetReelSeconds` follows the editorial guidance in
 * https://label-agency.fr/duree-reel-instagram/ : Instagram's *technical*
 * ceiling is ~90s, but the article is explicit that "using the max duration
 * without structure = loss of attention" and recommends picking a duration
 * based on the Reel's actual purpose — 15-30s for a teaser/promo, 30-60s for
 * a quick demo/short story, 60-90s only for a real mini-story/recap. Each
 * style below is mapped to the bracket matching its intent (viral/sport =
 * fast teaser, travel/adventure = short story, cinematic/luxury = premium
 * mini-story) instead of always maximizing toward the Instagram ceiling —
 * this also keeps the number of ffmpeg.wasm segments (and therefore render
 * time) reasonable regardless of how much source footage is uploaded.
 */
export interface StyleRecipe {
  /** Average seconds kept per clip before transitions overlap them — drives reel-length/clip-count math. */
  clipDuration: number;
  /** Shortest a single clip is ever allowed to be for this style — straight from `StylePreset.minShotDuration`. */
  minClipDuration: number;
  /** Longest a single clip is ever allowed to be for this style — straight from `StylePreset.maxShotDuration`. */
  maxClipDuration: number;
  /** Ken Burns zoom behaviour for each clip. */
  zoom: "in" | "out" | "alternate";
  /** How strong the zoom is (final zoom factor reached). */
  zoomIntensity: number;
  /** Playback speed multiplier. Keep this at 1 for the reel so the opening never starts in slow motion. */
  speed: number;
  /** Max number of best-moment clips used for the short Reel cut. */
  reelClipCount: number;
  /** [min, max] target total Reel duration (seconds) this style aims for — see doc comment above. */
  targetReelSeconds: [number, number];
}

/** Builds a style's `StyleRecipe`, pulling shot-duration range straight from its `StylePreset` so the two systems never disagree. */
function recipeFor(style: ReelStyle, rest: Omit<StyleRecipe, "clipDuration" | "minClipDuration" | "maxClipDuration">): StyleRecipe {
  const preset = STYLE_PRESETS[style];
  return {
    clipDuration: preset.averageShotDuration,
    minClipDuration: preset.minShotDuration,
    maxClipDuration: preset.maxShotDuration,
    ...rest,
  };
}

export const STYLE_RECIPES: Record<ReelStyle, StyleRecipe> = {
  viral: recipeFor("viral", {
    zoom: "alternate",
    zoomIntensity: 1.1,
    speed: 1.0,
    reelClipCount: 5,
    targetReelSeconds: [15, 30],
  }),
  travel: recipeFor("travel", {
    zoom: "in",
    zoomIntensity: 1.08,
    speed: 1.0,
    reelClipCount: 5,
    targetReelSeconds: [30, 60],
  }),
  adventure: recipeFor("adventure", {
    zoom: "alternate",
    zoomIntensity: 1.18,
    speed: 1.03,
    reelClipCount: 9,
    targetReelSeconds: [50, 60],
  }),
  sport: recipeFor("sport", {
    zoom: "in",
    zoomIntensity: 1.24,
    speed: 1.05,
    reelClipCount: 14,
    targetReelSeconds: [57, 60],
  }),
  cinematic: recipeFor("cinematic", {
    zoom: "out",
    zoomIntensity: 1.14,
    speed: 0.96,
    reelClipCount: 8,
    targetReelSeconds: [54, 60],
  }),
  luxury: recipeFor("luxury", {
    zoom: "in",
    zoomIntensity: 1.1,
    speed: 0.99,
    reelClipCount: 8,
    targetReelSeconds: [50, 60],
  }),
};
