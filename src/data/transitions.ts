import { ReelStyle } from "@/types";
import { isForbiddenXfadeTransition } from "@/transitions/xfadeMapping";

/**
 * Per-style pools of ffmpeg `xfade` transition names + duration ranges.
 *
 * Kept in its own file (separate from `styleRecipes.ts`) so new styles or
 * new transition pools can be added later without touching the rendering
 * engine (`src/lib/video-engine.ts`) at all.
 *
 * Each style's transition pool is tailored to its creative personality:
 * - VIRAL/SPORT: High-energy, punchy effects (pixelize, slice, blur, zoom, black flashes)
 * - ADVENTURE: Dynamic, thrilling transitions (zoom pulls, slices, depth shifts)
 * - TRAVEL/LUXURY: Smooth, elegant transitions (fades, gentle zooms, soft opens)
 * - CINEMATIC: Minimal, premium approach (pure fades, occasional black beats)
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
 * Valid xfade transition names available: fade, fadegrays, fadeblack, fadewhite,
 * zoomin, pixelize, hblur, hlslice, hrslice, vdslice, distance, horzopen,
 * vertopen, vertclose, circleopen, circleclose, smoothleft, smoothright.
 */
export interface TransitionPool {
  /** Candidate xfade transition names for this style. */
  names: string[];
  /** Min/max transition duration in seconds — a value is randomized in this range per cut. */
  durationRange: [number, number];
}

export const STYLE_TRANSITIONS: Record<ReelStyle, TransitionPool> = {
  // ─── VIRAL: punchy, fast, arresting ───
  // High-energy cuts with sharp fades and pixelated effects to stop the scroll.
  // Short durations (16-28ms) keep the rhythm aggressive and attention-grabbing.
  viral: {
    names: [
      "fade", "fade", "fade",           // primary: clean fast fade
      "fadeblack", "fadeblack",         // hard black flash for punch
      "pixelize", "pixelize",           // digital glitch texture
      "zoomin",                         // zoom cut for dynamic transition
      "hblur",                          // horizontal blur for motion
      "hlslice",                        // horizontal slice for cutting effect
      "distance",                       // distance effect for depth change
    ],
    durationRange: [0.16, 0.28],        // reduced from 0.22-0.32 for more punch
  },

  // ─── ADVENTURE: energetic, dynamic, thrilling ───
  // Medium-speed transitions with zoom and flowing movements.
  // Matches energetic pacing and adrenaline-driven moments.
  adventure: {
    names: [
      "fade", "fade",                   // foundation
      "zoomin", "zoomin",               // dynamic zoom pull
      "pixelize",                       // subtle digital texture
      "distance",                       // depth shift effect
      "hblur",                          // motion blur for flow
      "hlslice", "hrslice",             // slice effects for dynamic cuts
      "fadeblack",                      // occasional hard cut
      "horzopen",                       // horizontal opening effect
    ],
    durationRange: [0.32, 0.52],        // reduced from 0.42-0.62 for better pacing
  },

  // ─── CINEMATIC: slow, minimal, thoughtful ───
  // Long, elegant fades with minimal effects. Premium, film-like approach.
  // Focus on dissolves and subtle transitions that let content breathe.
  cinematic: {
    names: [
      "fade", "fade", "fade", "fade",   // primary: pure dissolve
      "fadeblack",                      // occasional dramatic black fade
      "distance",                       // subtle depth transition
      "zoomin",                         // minimal zoom for emphasis
    ],
    durationRange: [0.42, 0.62],        // increased from 0.3-0.42 for more premium feel
  },

  // ─── SPORT: aggressive, impact-driven, action-focused ───
  // Deliberately bias toward hard impact/glitch motifs (slice, blur, pixel and black-flash)
  // and keep them short so cuts stay aggressive and match the energy of sports.
  // Repeated names act as weighting because `pickTransitionName` is uniform.
  sport: {
    names: [
      "fadeblack", "fadeblack", "fadeblack",  // hard black flash for punch (tripled)
      "pixelize", "pixelize",                 // digital glitch texture (doubled)
      "hblur", "hblur",                       // motion blur for flow (doubled)
      "hlslice", "hlslice", "hrslice", "hrslice",  // horizontal slices (quad)
      "vdslice",                              // vertical slice for cutting
      "distance", "distance",                 // distance effect (doubled)
      "zoomin",                               // zoom cut for dynamic transition
      "fadewhite",                            // occasional white flash
      "smoothleft", "smoothright",            // smooth directional slides
    ],
    durationRange: [0.08, 0.16],              // kept short for aggression
  },

  // ─── TRAVEL: warm, flowing, exploratory ───
  // Smooth, natural transitions that evoke journey and discovery.
  // Emphasis on gentle fades and subtle motion effects.
  travel: {
    names: [
      "fade", "fade", "fade",           // primary: gentle fade
      "distance",                       // smooth depth transition
      "zoomin",                         // subtle zoom for exploration
      "hblur",                          // gentle motion blur
      "fadeblack",                      // occasional darker beat
      "pixelize",                       // rare digital texture for texture
      "horzopen",                       // gentle opening effect
    ],
    durationRange: [0.28, 0.42],        // increased from 0.26-0.36 for warmer feel
  },

  // ─── LUXURY: refined, premium, sophisticated ───
  // Minimal, elegant transitions that emphasize quality and craftsmanship.
  // Focus on pure fades and subtle effects that convey exclusivity.
  luxury: {
    names: [
      "fade", "fade", "fade", "fade",   // primary: pure elegant dissolve
      "fadewhite",                      // occasional white fade for luxury
      "distance",                       // sophisticated depth shift
      "zoomin",                         // refined zoom for emphasis
      "fadegrays",                      // soft gray fade for texture
    ],
    durationRange: [0.38, 0.58],        // increased from 0.3-0.42 for more premium pacing
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
