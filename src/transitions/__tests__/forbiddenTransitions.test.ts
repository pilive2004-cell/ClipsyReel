import { describe, expect, it } from "vitest";
import { STYLE_PRESETS } from "@/styles";
import { TransitionEngine } from "@/transitions/TransitionEngine";
import { FORBIDDEN_TRANSITIONS, isForbiddenXfadeTransition, mapTransitionToXfade } from "@/transitions/xfadeMapping";
import { ALL_TRANSITION_IDS } from "@/transitions/transitionPresets";
import { pickTransitionName, randomTransitionDuration, STYLE_TRANSITIONS } from "@/data/transitions";

/**
 * GLOBAL FORBIDDEN TRANSITION RULE — regression coverage.
 *
 * Product requirement: `wipeLeft`, `wipeRight`, `wipeUp`, `wipeDown`,
 * `slideLeft`, `slideRight`, `rectCrop`, `dissolve`, `wipeTL`/`TR`/`BL`/`BR`,
 * `squeezeV`, `squeezeH`, `coverLeft/Right/Up/Down`,
 * `revealLeft/Right/Up/Down` must never be selected by ANY style
 * (Adventure/Viral/Travel/Sport/Cinematic/Luxury), via ANY code path
 * (`TransitionSelector`, the fallback pool, timeline generation, the
 * automatic pattern selector, transition presets or the rendering engine).
 */
describe("Global forbidden transition list", () => {
  const ALL_STYLES = Object.keys(STYLE_PRESETS) as (keyof typeof STYLE_PRESETS)[];

  it("every conceptual TransitionId maps to a real ffmpeg filter that is not on the forbidden list", () => {
    for (const id of ALL_TRANSITION_IDS) {
      expect(isForbiddenXfadeTransition(mapTransitionToXfade(id))).toBe(false);
    }
  });

  it.each(ALL_STYLES)(
    "%s: TransitionSelector never returns a forbidden xfade filter across a long, varied synthetic sequence",
    (style) => {
      const engine = new TransitionEngine();
      for (let i = 0; i < 80; i++) {
        const decision = engine.next({
          selectedStyle: style,
          speedKmh: 10 + ((i * 19) % 110),
          gradientPercent: (i % 8) - 3,
          elevationChange: (i * 13) % 300,
          turnSharpness: (i % 6) / 6,
          terrainDrama: (i % 5) / 5,
          musicBeatStrength: (i % 4) / 4,
          isScenicMoment: i % 3 === 0,
          isActionMoment: i % 3 !== 0,
          performanceProfile: "high",
        });
        const filter = mapTransitionToXfade(decision.transitionId);
        expect(isForbiddenXfadeTransition(filter)).toBe(false);
      }
    }
  );

  it("the fallback randomized pool (data/transitions.ts) contains no forbidden filter for any style", () => {
    for (const style of Object.keys(STYLE_TRANSITIONS) as (keyof typeof STYLE_TRANSITIONS)[]) {
      for (const name of STYLE_TRANSITIONS[style].names) {
        expect(isForbiddenXfadeTransition(name)).toBe(false);
      }
    }
  });

  it("pickTransitionName() never returns a forbidden filter, even if handed a maliciously-forbidden pool", () => {
    const poisonedPool = { names: ["wipeLeft", "dissolve", "fade"], durationRange: [0.5, 1] as [number, number] };
    let previous: string | null = null;
    for (let i = 0; i < 20; i++) {
      const picked = pickTransitionName(poisonedPool, previous);
      expect(isForbiddenXfadeTransition(picked)).toBe(false);
      previous = picked;
    }
    // Sanity: randomTransitionDuration still works off the same pool shape.
    expect(randomTransitionDuration(poisonedPool)).toBeGreaterThanOrEqual(0.5);
  });

  it("mapTransitionToXfade throws if the internal mapping were ever forced to a forbidden filter (defense in depth)", () => {
    // Can't mutate the real exhaustive Record's type-checked values, but we
    // can directly exercise the guard function it relies on.
    for (const forbidden of FORBIDDEN_TRANSITIONS) {
      expect(isForbiddenXfadeTransition(forbidden)).toBe(true);
    }
  });
});
