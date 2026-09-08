import { describe, expect, it } from "vitest";
import { selectTransition } from "@/transitions/TransitionEngine";
import { TransitionSelector } from "@/transitions/TransitionSelector";
import { STYLE_PRESETS } from "@/styles";
import { TRANSITION_PRESETS, ALL_TRANSITION_IDS } from "@/transitions/transitionPresets";
import { VisualStyleId } from "@/types/style.types";
import { makeContext } from "@/transitions/__tests__/testUtils";

const ALL_STYLES: VisualStyleId[] = ["adventure", "viral", "travel", "sport", "cinematic", "luxury"];

describe("TransitionSelector — hard rules", () => {
  it("never selects a transition that is forbidden for the current style, across many contexts", () => {
    const speeds = [10, 45, 95];
    const beats = [0, 0.3, 0.7, 1];

    for (const style of ALL_STYLES) {
      const forbidden = new Set(STYLE_PRESETS[style].forbiddenTransitions);
      for (const speedKmh of speeds) {
        for (const musicBeatStrength of beats) {
          const decision = selectTransition(makeContext({ selectedStyle: style, speedKmh, musicBeatStrength, turnSharpness: 0.9, terrainDrama: 0.9 }));
          expect(forbidden.has(decision.transitionId)).toBe(false);
        }
      }
    }
  });

  it("never selects a transition outside the current style's compatibleStyles", () => {
    for (const style of ALL_STYLES) {
      const decision = selectTransition(makeContext({ selectedStyle: style }));
      expect(TRANSITION_PRESETS[decision.transitionId].compatibleStyles).toContain(style);
    }
  });

  it("avoids repeating the same transition on the very next shot when an alternative is compatible", () => {
    // Per explicit user request, the whole edit currently runs in
    // `SINGLE_TRANSITION_MODE` (one global cross fade everywhere), which
    // intentionally means every consecutive decision IS the same
    // transition — see `TransitionSelector.SINGLE_TRANSITION_MODE`. This
    // test now documents that current behavior instead of asserting the
    // (currently dormant) variety rule.
    const selector = new TransitionSelector();
    const first = selector.select(makeContext({ selectedStyle: "travel" }));
    const second = selector.select(makeContext({ selectedStyle: "travel", previousTransitionId: first.transitionId }));
    expect(first.transitionId).toBe("crossFade");
    expect(second.transitionId).toBe("crossFade");
  });

  it("every transition id in the library resolves to a definition matching its own id (data integrity sanity check)", () => {
    for (const id of ALL_TRANSITION_IDS) {
      expect(TRANSITION_PRESETS[id].id).toBe(id);
    }
  });
});

describe("TransitionSelector — required spec behaviors", () => {
  it("Viral is faster than Luxury for the same kind of moment", () => {
    const viral = selectTransition(makeContext({ selectedStyle: "viral", musicBeatStrength: 0.9, speedKmh: 90 }));
    const luxury = selectTransition(makeContext({ selectedStyle: "luxury", musicBeatStrength: 0.9, speedKmh: 90 }));
    expect(viral.duration).toBeLessThan(luxury.duration);
    // And each stays inside its own style's mandated duration window.
    expect(viral.duration).toBeGreaterThanOrEqual(0.6);
    expect(viral.duration).toBeLessThanOrEqual(1.5);
    expect(luxury.duration).toBeGreaterThanOrEqual(2.0);
    expect(luxury.duration).toBeLessThanOrEqual(4.0);
  });

  it("Viral has higher camera energy than Luxury", () => {
    expect(STYLE_PRESETS.viral.cameraEnergy).toBeGreaterThan(STYLE_PRESETS.luxury.cameraEnergy);
  });

  it("Luxury never selects glitch, impact or whip transitions", () => {
    const bannedSubstrings = ["glitch", "Impact", "impact", "whip", "Whip", "Shake", "shake"];
    for (const speedKmh of [5, 40, 100]) {
      for (const turnSharpness of [0, 0.5, 1]) {
        const decision = selectTransition(makeContext({ selectedStyle: "luxury", speedKmh, turnSharpness, terrainDrama: 0.9, musicBeatStrength: 0.9, isActionMoment: true }));
        expect(bannedSubstrings.some((s) => decision.transitionId.includes(s))).toBe(false);
      }
    }
  });

  it("Sport reacts to speed and sharp turns by choosing an action-event transition", () => {
    // SINGLE_TRANSITION_MODE currently overrides per-context personality
    // with one global cross fade — see the comment above.
    const decision = selectTransition(makeContext({ selectedStyle: "sport", speedKmh: 95, turnSharpness: 0.9, terrainDrama: 0.9, isActionMoment: true }));
    expect(decision.transitionId).toBe("crossFade");
  });

  it("Adventure prefers terrain-based transitions when terrain drama and elevation change are high", () => {
    // SINGLE_TRANSITION_MODE currently overrides per-context personality
    // with one global cross fade — see the comment above.
    const decision = selectTransition(makeContext({ selectedStyle: "adventure", terrainDrama: 0.9, elevationChange: 300, isScenicMoment: true }));
    expect(decision.transitionId).toBe("crossFade");
  });

  it("Travel prefers smooth flow transitions", () => {
    const decision = selectTransition(makeContext({ selectedStyle: "travel", isScenicMoment: true }));
    expect(TRANSITION_PRESETS[decision.transitionId].affinities).toContain("flow");
  });

  it("Cinematic prefers atmospheric/story transitions and avoids aggressive ones even under high-drama contexts", () => {
    // SINGLE_TRANSITION_MODE currently overrides per-context personality
    // with one global cross fade — see the comment above. Cross fade is
    // itself calm/subtle, so the "avoids aggressive transitions" half of
    // this rule still holds true even while forced to a single effect.
    const aggressiveIds = new Set(["glitchPulse", "flashCut", "beatCut", "zoomSmash", "whipPan", "hyperSpeedRamp", "impactZoom"]);
    for (const turnSharpness of [0, 0.5, 1]) {
      const decision = selectTransition(makeContext({ selectedStyle: "cinematic", turnSharpness, terrainDrama: 0.9, musicBeatStrength: 0.9, isScenicMoment: true }));
      expect(aggressiveIds.has(decision.transitionId)).toBe(false);
      expect(decision.transitionId).toBe("crossFade");
    }
  });

  it("the same GPX moment now produces the SAME single transition decision for every style (single-transition mode)", () => {
    // Per explicit user request, the whole edit currently uses one global
    // cross fade transition everywhere, so this deliberately inverts the
    // previous "different transition per style" spec assertion.
    const sharedMoment = { speedKmh: 80, gradientPercent: 8, elevationChange: 150, turnSharpness: 0.8, terrainDrama: 0.8, musicBeatStrength: 0.8, isScenicMoment: true, isActionMoment: true };
    const decisions = ALL_STYLES.map((style) => selectTransition(makeContext({ selectedStyle: style, ...sharedMoment })));
    const ids = decisions.map((d) => d.transitionId);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe("crossFade");
  });
});

describe("TransitionSelector — style personality (legacy-style checks)", () => {
  it("Viral (like every style) currently uses the single global cross fade transition", () => {
    // SINGLE_TRANSITION_MODE currently overrides Viral's "high-intensity"
    // personality with one global, calm cross fade — see the comment above.
    const decision = selectTransition(makeContext({ selectedStyle: "viral", musicBeatStrength: 0.9, speedKmh: 90 }));
    expect(decision.transitionId).toBe("crossFade");
  });

  it("Luxury chooses low-intensity transitions", () => {
    const decision = selectTransition(makeContext({ selectedStyle: "luxury" }));
    expect(TRANSITION_PRESETS[decision.transitionId].intensity).toBeLessThanOrEqual(3);
  });
});
