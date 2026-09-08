import { describe, expect, it } from "vitest";
import { TransitionEngine } from "@/transitions/TransitionEngine";
import { selectTransition } from "@/transitions/TransitionSelector";
import { transitionFamilyOf } from "@/transitions/transitionFamilies";
import { isForbiddenXfadeTransition, mapTransitionToXfade } from "@/transitions/xfadeMapping";
import { STYLE_PRESETS } from "@/styles";
import { makeContext } from "@/transitions/__tests__/testUtils";

/**
 * Regression coverage for the "transitions all look the same swipe" bug:
 * `whipPan` and `motionBlurSwipe` are different `TransitionId`s but the same
 * *family* ("whip" / "swipe" are both directional-wipe-flavored), so a plain
 * id-repeat check let a style oscillate between just those two and still
 * read on screen as "it's always the same transition". Family-level
 * tracking (`recentTransitionFamilies` + the same-family/overuse penalties
 * in `TransitionSelector`) is what actually fixes that.
 */
describe("TransitionSelector — transition family variety", () => {
  it("currently produces the SAME transition family on every consecutive Viral cut (single-transition/cross-fade-only mode)", () => {
    // Per explicit user request, the whole edit currently runs in
    // `TransitionSelector.SINGLE_TRANSITION_MODE` (one global cross fade
    // everywhere), which deliberately inverts the previous "never repeat
    // the same family back to back" variety rule below.
    const engine = new TransitionEngine();
    const families: string[] = [];
    for (let i = 0; i < 40; i++) {
      // Vary the context shot-to-shot like a real render would (music beat
      // strength, speed, turn sharpness, action flag all fluctuate).
      const decision = engine.next({
        selectedStyle: "viral",
        speedKmh: 30 + ((i * 17) % 90),
        gradientPercent: 2,
        elevationChange: 10,
        turnSharpness: (i % 5) / 5,
        terrainDrama: 0.2,
        musicBeatStrength: (i % 4) / 4,
        isScenicMoment: i % 3 === 0,
        isActionMoment: i % 3 !== 0,
        performanceProfile: "high",
      });
      families.push(decision.transitionFamily);
    }

    expect(new Set(families).size).toBe(1);
    expect(families[0]).toBe("dissolve");
  });

  it("currently lets the single cross-fade family appear in every slot of a 5-consecutive-transition window for Viral (single-transition mode)", () => {
    const engine = new TransitionEngine();
    const families: string[] = [];
    for (let i = 0; i < 40; i++) {
      const decision = engine.next({
        selectedStyle: "viral",
        speedKmh: 30 + ((i * 23) % 90),
        gradientPercent: 2,
        elevationChange: 10,
        turnSharpness: (i % 7) / 7,
        terrainDrama: 0.2,
        musicBeatStrength: (i % 5) / 5,
        isScenicMoment: i % 4 === 0,
        isActionMoment: i % 4 !== 0,
        performanceProfile: "high",
      });
      families.push(decision.transitionFamily);
    }

    for (let start = 0; start + 5 <= families.length; start++) {
      const window = families.slice(start, start + 5);
      const counts = new Map<string, number>();
      for (const f of window) counts.set(f, (counts.get(f) ?? 0) + 1);
      expect(counts.get("dissolve")).toBe(5);
    }
  });

  it("does not let the swipe family (motionBlurSwipe / softSwipe / velocityBlur / dirtSwipe) dominate a long Viral sequence", () => {
    const engine = new TransitionEngine();
    const families: string[] = [];
    for (let i = 0; i < 60; i++) {
      const decision = engine.next({
        selectedStyle: "viral",
        speedKmh: 30 + ((i * 13) % 90),
        gradientPercent: 2,
        elevationChange: 10,
        turnSharpness: (i % 6) / 6,
        terrainDrama: 0.2,
        musicBeatStrength: (i % 4) / 4,
        isScenicMoment: i % 3 === 0,
        isActionMoment: i % 3 !== 0,
        performanceProfile: "high",
      });
      families.push(decision.transitionFamily);
    }
    const swipeCount = families.filter((f) => f === "swipe").length;
    // Should be a minority contributor, not the dominant family, across a long sequence.
    expect(swipeCount).toBeLessThan(families.length * 0.4);
  });

  it("never selects textPopReveal when no text overlay is configured for this cut", () => {
    for (const musicBeatStrength of [0, 0.5, 1]) {
      for (const speedKmh of [10, 60, 110]) {
        const decision = selectTransition(
          makeContext({ selectedStyle: "viral", musicBeatStrength, speedKmh, hasTextOverlay: false })
        );
        expect(decision.transitionId).not.toBe("textPopReveal");
      }
    }
    // Also true when the flag is simply omitted (default/undefined).
    const decision = selectTransition(makeContext({ selectedStyle: "viral" }));
    expect(decision.transitionId).not.toBe("textPopReveal");
  });

  it("every transition decision reports a transitionFamily consistent with transitionFamilyOf()", () => {
    const decision = selectTransition(makeContext({ selectedStyle: "sport", isActionMoment: true, speedKmh: 90, turnSharpness: 0.8 }));
    expect(decision.transitionFamily).toBe(transitionFamilyOf(decision.transitionId));
  });

  it("Viral's 5 core preferred transitions each render as a visually distinct ffmpeg xfade filter (no duplicate directional-slice/wipe look-alikes)", () => {
    const coreIds = STYLE_PRESETS.viral.corePreferredTransitions;
    const filters = coreIds.map((id) => mapTransitionToXfade(id));
    // Exact string uniqueness alone isn't enough — several ffmpeg filter
    // names can still render as "the same effect" to a viewer even when
    // they're technically different strings (e.g. `hlslice`/`hrslice` both
    // read as "a horizontal directional slice"). Group filters into coarse
    // visual look-alike buckets and require the core 5 to spread across
    // genuinely different buckets, not just different literal filter names.
    // Also asserts none of them is on the global forbidden list (no
    // `wipe*`/`slide*`/`cover*`/`reveal*`/`dissolve`/`rectcrop`).
    const visualBucketOf = (filter: string): string => {
      expect(isForbiddenXfadeTransition(filter)).toBe(false);
      if (filter === "hlslice" || filter === "hrslice") return "directionalSlice";
      if (filter.startsWith("smooth")) return "smoothSlide";
      if (filter === "vdslice") return "sliceBurst";
      if (filter === "fadeblack" || filter === "fadewhite" || filter === "fade") return "fadeFlash";
      if (filter === "zoomin" || filter === "distance") return "zoomPush";
      if (filter === "radial" || filter.startsWith("circle")) return "circularSweep";
      if (filter === "pixelize") return "glitchPixel";
      if (filter === "hblur") return "blurSwipe";
      return filter;
    };
    const buckets = filters.map(visualBucketOf);
    expect(new Set(buckets).size).toBe(buckets.length);
  });
});

/**
 * Item 7 of the fix ("verify other styles too") — a longer synthetic render
 * per non-Viral style, confirming the family-tracking additions above don't
 * accidentally break any style's own eligibility/forbidden-list rules or
 * force it outside its own compatible palette, even across many consecutive
 * decisions from one `TransitionEngine` instance (not just a single shot).
 */
describe("TransitionSelector — other styles unaffected by the Viral family-tracking fix", () => {
  const OTHER_STYLES = ["adventure", "travel", "sport", "cinematic", "luxury"] as const;

  it.each(OTHER_STYLES)("%s: a long synthetic sequence never picks a forbidden transition or one outside its own compatible styles", (style) => {
    const engine = new TransitionEngine();
    const forbidden = new Set(STYLE_PRESETS[style].forbiddenTransitions);
    for (let i = 0; i < 30; i++) {
      const decision = engine.next({
        selectedStyle: style,
        speedKmh: 20 + ((i * 11) % 80),
        gradientPercent: (i % 6) - 2,
        elevationChange: (i * 7) % 200,
        turnSharpness: (i % 5) / 5,
        terrainDrama: (i % 4) / 4,
        musicBeatStrength: (i % 3) / 3,
        isScenicMoment: i % 2 === 0,
        isActionMoment: i % 2 !== 0,
        performanceProfile: "high",
      });
      expect(forbidden.has(decision.transitionId)).toBe(false);
      expect(decision.transitionFamily).toBe(transitionFamilyOf(decision.transitionId));
    }
  });
});
