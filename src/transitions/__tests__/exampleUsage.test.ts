import { describe, expect, it } from "vitest";
import { demonstrateSameMomentAcrossStyles } from "@/transitions/TransitionEngine";

/**
 * Verifies the exact "same GPX moment, 6 different style behaviors" example
 * required by the spec (item 6): high speed, medium gradient, sharp turn,
 * high terrain drama, strong music beat.
 *
 * Per explicit user request, the whole edit currently runs in
 * `TransitionSelector.SINGLE_TRANSITION_MODE` — one global cross fade
 * everywhere instead of each style picking from its own signature palette.
 * These tests now document that current, deliberate behavior; flip
 * `SINGLE_TRANSITION_MODE` back to restore the original per-style variety
 * assertions.
 */
describe("demonstrateSameMomentAcrossStyles", () => {
  it("currently gives every style the same single cross fade transition (single-transition mode)", () => {
    const results = demonstrateSameMomentAcrossStyles();

    for (const style of ["adventure", "viral", "travel", "sport", "cinematic", "luxury"] as const) {
      expect(results[style].transitionId).toBe("crossFade");
    }
  });

  it("gives every style the same transition id for the exact same moment (single-transition mode)", () => {
    const results = demonstrateSameMomentAcrossStyles();
    const ids = Object.values(results).map((d) => d.transitionId);
    expect(new Set(ids).size).toBe(1);
  });

  it("every decision includes a non-empty, human-readable reason", () => {
    const results = demonstrateSameMomentAcrossStyles();
    for (const decision of Object.values(results)) {
      expect(decision.reason.length).toBeGreaterThan(10);
    }
  });
});
