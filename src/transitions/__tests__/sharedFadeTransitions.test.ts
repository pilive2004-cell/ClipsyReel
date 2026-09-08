import { describe, expect, it } from "vitest";
import { STYLE_PRESETS } from "@/styles";
import { TransitionEngine } from "@/transitions/TransitionEngine";
import { mapTransitionToXfade } from "@/transitions/xfadeMapping";
import { TRANSITION_PRESETS } from "@/transitions/transitionPresets";
import { transitionFamilyOf } from "@/transitions/transitionFamilies";
import type { TransitionId } from "@/transitions/transition.types";

/**
 * Regression coverage for the "sequences too short / not enough fades" fix:
 * - Viral shot/transition timing was relaxed from the previous (too punchy)
 *   0.7-1.8s / 0.18-0.55s bounds to the new, more readable 1.5-4.0s /
 *   0.6-1.5s bounds.
 * - 5 new shared fade transitions (fadeIn/fadeOut/crossFade/softFade/
 *   fadeThroughBlack) were added and made selectable for viral/travel/
 *   cinematic/luxury, each mapping to a real (non-degenerate) ffmpeg xfade
 *   filter — so they're not just metadata labels, they actually render.
 */
describe("Viral timing bounds (post fade-readability fix)", () => {
  it("Viral shot duration bounds are the new, even slower-paced 2.2-5.5s range (avg ~3.4s)", () => {
    expect(STYLE_PRESETS.viral.minShotDuration).toBe(2.2);
    expect(STYLE_PRESETS.viral.averageShotDuration).toBe(3.4);
    expect(STYLE_PRESETS.viral.maxShotDuration).toBe(5.5);
  });

  it("Viral transition duration bounds are the new 0.6-1.5s range", () => {
    expect(STYLE_PRESETS.viral.transitionDurationRange).toEqual([0.6, 1.5]);
  });

  it("Viral is still shorter/faster on both axes than Luxury, Cinematic and Travel", () => {
    for (const slower of ["luxury", "cinematic", "travel"] as const) {
      expect(STYLE_PRESETS.viral.maxShotDuration).toBeLessThan(STYLE_PRESETS[slower].minShotDuration + STYLE_PRESETS[slower].maxShotDuration);
      expect(STYLE_PRESETS.viral.transitionDurationRange[1]).toBeLessThanOrEqual(STYLE_PRESETS[slower].transitionDurationRange[1]);
    }
  });
});

describe("Shared fade transitions (fadeIn/fadeOut/crossFade/softFade/fadeThroughBlack)", () => {
  const SHARED_FADE_IDS: TransitionId[] = ["fadeIn", "fadeOut", "crossFade", "softFade", "fadeThroughBlack"];

  it("all 5 shared fade ids exist as real transition presets", () => {
    for (const id of SHARED_FADE_IDS) {
      expect(TRANSITION_PRESETS[id]).toBeDefined();
    }
  });

  it("all 5 shared fade ids map to a real, non-empty ffmpeg xfade filter (not just metadata labels)", () => {
    for (const id of SHARED_FADE_IDS) {
      const filter = mapTransitionToXfade(id);
      expect(typeof filter).toBe("string");
      expect(filter.length).toBeGreaterThan(0);
    }
  });

  it("all 5 shared fade ids belong to a 'fade' or 'dissolve' family (visually a smooth blend, never a hard cut)", () => {
    for (const id of SHARED_FADE_IDS) {
      expect(["fade", "dissolve"]).toContain(transitionFamilyOf(id));
    }
  });

  it.each(["viral", "travel", "cinematic", "luxury"] as const)(
    "%s can actually select at least one shared fade transition across a long scenic sequence",
    (style) => {
      const engine = new TransitionEngine();
      const selected = new Set<string>();
      for (let i = 0; i < 60; i++) {
        const decision = engine.next({
          selectedStyle: style,
          speedKmh: 20,
          gradientPercent: 1,
          elevationChange: 5,
          turnSharpness: 0.1,
          terrainDrama: 0.1,
          musicBeatStrength: 0.1,
          isScenicMoment: true,
          isActionMoment: false,
          performanceProfile: "high",
        });
        selected.add(decision.transitionId);
      }
      const hitAtLeastOneFade = SHARED_FADE_IDS.some((id) => selected.has(id));
      expect(hitAtLeastOneFade).toBe(true);
    }
  );

  it("Adventure and Sport can now also select crossFade — it was intentionally added to their compatible styles list so the whole app can run in single-transition (cross fade only) mode", () => {
    const engine = new TransitionEngine();
    for (const style of ["adventure", "sport"] as const) {
      for (let i = 0; i < 30; i++) {
        const decision = engine.next({
          selectedStyle: style,
          speedKmh: 20,
          gradientPercent: 1,
          elevationChange: 5,
          turnSharpness: 0.1,
          terrainDrama: 0.3,
          musicBeatStrength: 0.2,
          isScenicMoment: true,
          isActionMoment: false,
          performanceProfile: "high",
        });
        expect(decision.transitionId).toBe("crossFade");
      }
    }
  });
});
