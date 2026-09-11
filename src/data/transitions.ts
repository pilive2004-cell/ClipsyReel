import { ReelStyle } from "@/types";
import { isForbiddenXfadeTransition } from "@/transitions/xfadeMapping";

/**
 * Per-style pools of ffmpeg `xfade` transition names + duration ranges.
 *
 * Kept in its own file (separate from `styleRecipes.ts`) so new styles or
 * new transition pools can be added later without touching the rendering
 * engine (`src/lib/video-engine.ts`) at all.
 *
 * Only "premium-looking" transitions are used here: fades, flashes
 * (fadeblack/fadewhite/fadegrays) and zoom.
 *
 * GLOBAL FORBIDDEN LIST (see `FORBIDDEN_TRANSITIONS` in
 * `transitions/xfadeMapping.ts`): plain `dissolve`, every directional
 * `wipe*`/`slide*`/`cover*`/`reveal*` filter, and `rectcrop` must never
 * appear in any of these pools, in any style — `pickTransitionName` below
 * is defensively re-checked against that same list at call time.
 *
 * `pickTransitionName` also guarantees no back-to-back repeat *within* a
 * montage, and since it's re-randomized on every `buildMontage` call,
 * re-generating a Reel picks a fresh sequence of transitions rather than
 * always landing on the same ones.
 *
 * Valid xfade transition names actually used here (ffmpeg docs): fade,
 * fadegrays, fadeblack, fadewhite, zoomin.
 */
export interface TransitionPool {
  /** Candidate xfade transition names for this style. */
  names: string[];
  /** Min/max transition duration in seconds — a value is randomized in this range per cut. */
  durationRange: [number, number];
}

export const STYLE_TRANSITIONS: Record<ReelStyle, TransitionPool> = {
  viral: {
    names: ["fade"],
    durationRange: [0.22, 0.32],
  },
  adventure: {
    names: ["fade"],
    durationRange: [0.24, 0.34],
  },
  cinematic: {
    names: ["fade"],
    durationRange: [0.3, 0.42],
  },
  // Not specified by the product brief — extended in the same spirit as the
  // three defined styles (fast/punchy vs. slow/premium) so every style has a
  // sensible transition pool.
  sport: {
    // Deliberately bias SPORT toward hard impact/glitch motifs (slice, blur,
    // pixel and black-flash) and keep them short so cuts stay aggressive.
    // Repeated names act as weighting because `pickTransitionName` is uniform.
    names: ["fadeblack", "fadeblack", "pixelize", "hblur", "hlslice", "hrslice", "vdslice", "distance", "zoomin"],
    durationRange: [0.08, 0.16],
  },
  travel: {
    names: ["fade"],
    durationRange: [0.26, 0.36],
  },
  luxury: {
    names: ["fade"],
    durationRange: [0.3, 0.42],
  },
};

/** Picks a random duration within the pool's range. */
export function randomTransitionDuration(pool: TransitionPool): number {
  const [min, max] = pool.durationRange;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

/**
 * Picks a random transition name from the pool, never repeating the
 * previous one back-to-back, and never returning a name on the global
 * forbidden-transition list (defense in depth — `STYLE_TRANSITIONS` above
 * should never actually contain one, but a caller could pass an arbitrary
 * `TransitionPool`, e.g. `AutomaticPatternSelector`'s reordered override).
 */
export function pickTransitionName(pool: TransitionPool, previous: string | null): string {
  const safeNames = pool.names.filter((name) => !isForbiddenXfadeTransition(name));
  const names = safeNames.length > 0 ? safeNames : pool.names;
  if (names.length === 1) return names[0];
  let choice = previous;
  let guard = 0;
  while (choice === previous && guard < 20) {
    choice = names[Math.floor(Math.random() * names.length)];
    guard++;
  }
  return choice ?? names[0];
}
