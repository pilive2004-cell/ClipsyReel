import { ReelStyle } from "@/types";

/**
 * Editing "recipe" applied per style when building the real montage with
 * ffmpeg.wasm (see `src/lib/video-engine.ts`).
 *
 * These values drive:
 * - how long each detected best-moment clip is kept
 * - which xfade transition type ffmpeg uses between clips
 * - how strong / in which direction the Ken Burns zoom effect moves
 * - a subtle speed ramp (slow-mo for cinematic/luxury, snappy for viral/sport)
 *
 * FUTURE: these could become user-tunable ("editing intensity" slider) or be
 * chosen automatically by a real ML model based on the footage content.
 */
export interface StyleRecipe {
  /** Seconds kept per clip before transitions overlap them. */
  clipDuration: number;
  /** Ken Burns zoom behaviour for each clip. */
  zoom: "in" | "out" | "alternate";
  /** How strong the zoom is (final zoom factor reached). */
  zoomIntensity: number;
  /** Playback speed multiplier (1 = normal, <1 = slow-mo, >1 = snappier). */
  speed: number;
  /** Max number of best-moment clips used for the short Reel cut. */
  reelClipCount: number;
}

export const STYLE_RECIPES: Record<ReelStyle, StyleRecipe> = {
  viral: {
    clipDuration: 1.5,
    zoom: "alternate",
    zoomIntensity: 1.25,
    speed: 1.05,
    reelClipCount: 6,
  },
  travel: {
    clipDuration: 2.6,
    zoom: "in",
    zoomIntensity: 1.15,
    speed: 1.0,
    reelClipCount: 5,
  },
  adventure: {
    clipDuration: 1.8,
    zoom: "alternate",
    zoomIntensity: 1.2,
    speed: 1.05,
    reelClipCount: 6,
  },
  sport: {
    clipDuration: 1.2,
    zoom: "in",
    zoomIntensity: 1.3,
    speed: 1.08,
    reelClipCount: 6,
  },
  cinematic: {
    clipDuration: 3.2,
    zoom: "out",
    zoomIntensity: 1.18,
    speed: 0.96,
    reelClipCount: 4,
  },
  luxury: {
    clipDuration: 2.8,
    zoom: "in",
    zoomIntensity: 1.12,
    speed: 1.0,
    reelClipCount: 5,
  },
};
