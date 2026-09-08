import { describe, expect, it } from "vitest";
import { capTransitionDuration } from "../video-engine";
import { STYLE_PRESETS } from "@/styles";

/**
 * Regression test: before this cap existed, a short Viral/Sport shot near
 * its own minimum duration (e.g. 0.35s) next to a 0.4-0.5s transition base
 * got a transition duration equal to the clip's ENTIRE length —
 * `Math.min(base, prevLen, nextLen)` alone never protected against that.
 * `xfade` overlaps the last `duration` seconds of one clip with the first
 * `duration` seconds of the next, so a transition as long as the clip itself
 * means zero clear, non-blended frames of it ever show — "transitions are
 * too fast, you can't even see the shot".
 */
describe("capTransitionDuration", () => {
  it("never consumes an entire short clip, even when the style's transition base is close to or exceeds the clip length", () => {
    // 0.5s transition base next to a 0.35s clip: previously = 0.35s (100% of the clip).
    const result = capTransitionDuration(0.5, 0.35, 0.9);
    expect(result).toBeLessThan(0.35);
    expect(result).toBeCloseTo(0.35 * 0.2, 5);
  });

  it("caps against whichever adjacent clip is shorter", () => {
    const result = capTransitionDuration(0.5, 0.9, 0.3);
    expect(result).toBeCloseTo(0.3 * 0.2, 5);
  });

  it("still lets the full style-intended duration through when both clips are comfortably long", () => {
    const result = capTransitionDuration(0.5, 4, 5);
    expect(result).toBe(0.5);
  });

  it("never returns a negative duration for degenerate (near-zero) clip lengths", () => {
    const result = capTransitionDuration(0.5, 0, 0.1);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("leaves at least (1 - maxFraction) of every clip as pure, non-blended content", () => {
    const prevLen = 0.4;
    const nextLen = 0.6;
    const result = capTransitionDuration(2, prevLen, nextLen);
    expect(result).toBeLessThanOrEqual(prevLen * 0.2);
    expect(result).toBeLessThanOrEqual(nextLen * 0.2);
  });

  it("guarantees at least 60% of a clip's own duration stays pure/unblended even in the worst case of BOTH its adjacent transitions maxing out", () => {
    // A clip participates in 2 transitions: one as the "next" clip of the cut
    // before it, one as the "prev" clip of the cut after it. Simulate the
    // worst case where both neighboring transitions are long enough to hit
    // the cap on this exact clip's length from both sides.
    const clipLength = 2.5;
    const incoming = capTransitionDuration(10, 3.0, clipLength); // long transition base, forced to hit the cap
    const outgoing = capTransitionDuration(10, clipLength, 3.0);
    const consumed = incoming + outgoing;
    const solidFraction = (clipLength - consumed) / clipLength;
    expect(solidFraction).toBeGreaterThanOrEqual(0.6 - 1e-9);
  });

  it.each(Object.keys(STYLE_PRESETS) as (keyof typeof STYLE_PRESETS)[])(
    "%s: a run of average-length clips with average-length transitions always keeps at least 55% of every clip pure/unblended (real style numbers, not synthetic ones)",
    (style) => {
      const preset = STYLE_PRESETS[style];
      const avgClip = preset.averageShotDuration;
      const [transitionMin, transitionMax] = preset.transitionDurationRange;
      const avgTransition = (transitionMin + transitionMax) / 2;
      // Worst case for a middle clip in a long run of identical clips: both
      // its incoming and outgoing transitions independently try to use the
      // style's average transition duration.
      const perEdge = capTransitionDuration(avgTransition, avgClip, avgClip);
      const consumed = perEdge * 2;
      const solidFraction = (avgClip - consumed) / avgClip;
      expect(solidFraction).toBeGreaterThanOrEqual(0.55);
    }
  );
});
