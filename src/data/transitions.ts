import { ReelStyle } from "@/types";

/**
 * Per-style pools of ffmpeg `xfade` transition names + duration ranges.
 *
 * Kept in its own file (separate from `styleRecipes.ts`) so new styles or
 * new transition pools can be added later without touching the rendering
 * engine (`src/lib/video-engine.ts`) at all.
 *
 * Valid xfade transition names (ffmpeg docs): fade, wipeleft, wiperight,
 * wipeup, wipedown, slideleft, slideright, slideup, slidedown, circlecrop,
 * rectcrop, distance, fadeblack, fadewhite, radial, smoothleft, smoothright,
 * smoothup, smoothdown, circleopen, circleclose, vertopen, vertclose,
 * horzopen, horzclose, dissolve, pixelize, hblur, zoomin, and more.
 */
export interface TransitionPool {
  /** Candidate xfade transition names for this style. */
  names: string[];
  /** Min/max transition duration in seconds — a value is randomized in this range per cut. */
  durationRange: [number, number];
}

export const STYLE_TRANSITIONS: Record<ReelStyle, TransitionPool> = {
  viral: {
    names: ["zoomin", "slideleft", "slideright"],
    durationRange: [0.3, 0.5],
  },
  adventure: {
    names: ["zoomin", "dissolve", "smoothleft", "smoothright"],
    durationRange: [0.5, 1],
  },
  cinematic: {
    names: ["fade", "dissolve", "fadeblack", "radial"],
    durationRange: [1, 1.5],
  },
  // Not specified by the product brief — extended in the same spirit as the
  // three defined styles (fast/punchy vs. slow/premium) so every style has a
  // sensible transition pool.
  sport: {
    names: ["zoomin", "slideleft", "slideright", "circleopen"],
    durationRange: [0.25, 0.45],
  },
  travel: {
    names: ["dissolve", "smoothleft", "smoothright", "fade"],
    durationRange: [0.6, 1],
  },
  luxury: {
    names: ["fade", "dissolve", "circleopen", "radial"],
    durationRange: [0.9, 1.4],
  },
};

/** Picks a random duration within the pool's range. */
export function randomTransitionDuration(pool: TransitionPool): number {
  const [min, max] = pool.durationRange;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

/** Picks a random transition name from the pool, never repeating the previous one back-to-back. */
export function pickTransitionName(pool: TransitionPool, previous: string | null): string {
  if (pool.names.length === 1) return pool.names[0];
  let choice = previous;
  let guard = 0;
  while (choice === previous && guard < 20) {
    choice = pool.names[Math.floor(Math.random() * pool.names.length)];
    guard++;
  }
  return choice ?? pool.names[0];
}
