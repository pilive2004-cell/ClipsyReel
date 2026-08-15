import { ReelStyle } from "@/types";

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
  /** Playback speed multiplier. Keep this at 1 for the reel so the opening never starts in slow motion. */
  speed: number;
  /** Max number of best-moment clips used for the short Reel cut. */
  reelClipCount: number;
}

export const STYLE_RECIPES: Record<ReelStyle, StyleRecipe> = {
  viral: {
    clipDuration: 4.6,
    zoom: "alternate",
    zoomIntensity: 1.1,
    speed: 1.0,
    reelClipCount: 5,
  },
  travel: {
    clipDuration: 5.2,
    zoom: "in",
    zoomIntensity: 1.08,
    speed: 1.0,
    reelClipCount: 5,
  },
  adventure: {
    clipDuration: 4.9,
    zoom: "alternate",
    zoomIntensity: 1.1,
    speed: 1.0,
    reelClipCount: 5,
  },
  sport: {
    clipDuration: 4.0,
    zoom: "in",
    zoomIntensity: 1.12,
    speed: 1.0,
    reelClipCount: 5,
  },
  cinematic: {
    clipDuration: 5.4,
    zoom: "out",
    zoomIntensity: 1.08,
    speed: 1.0,
    reelClipCount: 5,
  },
  luxury: {
    clipDuration: 5.0,
    zoom: "in",
    zoomIntensity: 1.08,
    speed: 1.0,
    reelClipCount: 5,
  },
};
