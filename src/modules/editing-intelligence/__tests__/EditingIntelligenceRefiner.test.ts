import { describe, expect, it } from "vitest";
import { refineSegmentOrderWithEditingIntelligence, type RefinableSegment } from "../EditingIntelligenceRefiner";

/**
 * Regression test for a real bug: `endOnStrongestScene` (and, more broadly,
 * `progressiveIntensity` / `avoidRepetitivePatterns`) reorder clips purely by
 * score/energy/history with zero adjacency awareness. Moving the strongest
 * clip to the end displaces whatever was there into an earlier slot — and
 * that displaced clip can land right next to a near-duplicate of itself,
 * even though `no-consecutive-similar-clips` had already fixed the original
 * order. This is exactly what caused "the same shot comes back several
 * times in a row" in production renders.
 */
function isSimilar(a: RefinableSegment, b: RefinableSegment): boolean {
  if (a.sourceIndex !== b.sourceIndex) return false;
  return Math.abs(a.start - b.start) < Math.min(a.length, b.length) * 1.2;
}

function hasAdjacentSimilarPair(segments: RefinableSegment[]): boolean {
  for (let i = 1; i < segments.length; i++) {
    if (isSimilar(segments[i - 1], segments[i])) return true;
  }
  return false;
}

describe("refineSegmentOrderWithEditingIntelligence", () => {
  it("never leaves two near-duplicate clips adjacent after end-on-strongest-scene displaces a clip into an earlier slot", () => {
    // Crafted so `endOnStrongestScene` moves body[1] (highest confidence) to
    // the final slot and displaces body[3] into body[1]'s old position —
    // landing it right next to body[0], which is a near-duplicate of it
    // (same sourceIndex, start times within the similarity window). Without
    // the anti-repeat rule running LAST (with adjacency-safe swapping), this
    // reproduces the "same shot twice in a row" bug exactly.
    const body: RefinableSegment[] = [
      { sourceIndex: 10, start: 0, length: 1, confidence: 40, narrativeRole: "journey" },
      { sourceIndex: 20, start: 0, length: 1, confidence: 99, narrativeRole: "journey" }, // strongest -> moved to end
      { sourceIndex: 30, start: 0, length: 1, confidence: 50, narrativeRole: "journey" },
      { sourceIndex: 10, start: 0.5, length: 1, confidence: 60, narrativeRole: "journey" }, // near-dup of body[0] -> displaced into body[1]'s slot
      { sourceIndex: 40, start: 0, length: 1, confidence: 55, narrativeRole: "journey" },
    ];

    const { segments } = refineSegmentOrderWithEditingIntelligence(body, {
      hookCount: 0,
      storageKey: "test:editing-intelligence:no-repeat:end-on-strongest",
    });

    expect(segments).toHaveLength(body.length);
    expect(hasAdjacentSimilarPair(segments)).toBe(false);
  });

  it("fixes a hook/body seam clash where the reordered body's new first clip is a near-duplicate of the last hook clip", () => {
    const hook: RefinableSegment[] = [
      { sourceIndex: 0, start: 0, length: 1, confidence: 90, narrativeRole: "opening-hook" },
      { sourceIndex: 10, start: 0, length: 1, confidence: 85, narrativeRole: "opening-hook" }, // last hook clip
    ];
    const body: RefinableSegment[] = [
      { sourceIndex: 10, start: 0.5, length: 1, confidence: 40, narrativeRole: "journey" }, // near-dup of last hook clip
      { sourceIndex: 20, start: 0, length: 1, confidence: 50, narrativeRole: "journey" },
      { sourceIndex: 30, start: 0, length: 1, confidence: 45, narrativeRole: "journey" },
    ];

    const { segments } = refineSegmentOrderWithEditingIntelligence([...hook, ...body], {
      hookCount: 2,
      storageKey: "test:editing-intelligence:no-repeat:hook-seam",
    });

    expect(segments).toHaveLength(hook.length + body.length);
    expect(hasAdjacentSimilarPair(segments)).toBe(false);
  });

  it("is a pure reorder — never drops, invents, or duplicates a segment", () => {
    const input: RefinableSegment[] = Array.from({ length: 9 }, (_, i) => ({
      sourceIndex: i % 3,
      start: i * 5,
      length: 1,
      confidence: 30 + i * 7,
      motion: 0.2 + i * 0.05,
      clarity: 0.5,
      narrativeRole: (i === 5 ? "peak-moment" : i < 2 ? "opening-hook" : "journey") as RefinableSegment["narrativeRole"],
    }));

    const { segments } = refineSegmentOrderWithEditingIntelligence(input, { hookCount: 2 });

    expect(segments).toHaveLength(input.length);
    const inputKey = (s: RefinableSegment) => `${s.sourceIndex}@${s.start}`;
    const inputSet = new Set(input.map(inputKey));
    const outputSet = new Set(segments.map(inputKey));
    expect(outputSet).toEqual(inputSet);
  });
});
