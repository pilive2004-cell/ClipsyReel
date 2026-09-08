import { describe, expect, it } from "vitest";
import { planReelSegments, type Segment } from "../video-engine";
import { STYLE_RECIPES } from "@/data/styleRecipes";
import type { BestMoment } from "@/types";

/**
 * Regression test for a real bug: a single continuous take (e.g. a slow
 * drone orbit) can get several high-confidence "best moments" flagged only
 * a few seconds apart — all technically distinct clips, but visually the
 * same subject/scene since nothing actually changed in that stretch.
 * `removeNearDuplicateSegments` only catches near-overlapping timestamps
 * (a window close to the clip's own short duration), so it let the
 * round-robin selection pick 2-3 of these near-identical moments from the
 * SAME source into one reel — reading as "the same shot keeps coming back"
 * even though each one is a technically distinct cut. `planReelSegments`
 * must now require same-source picks to be spread across a meaningful
 * fraction of that source's own duration.
 */
function moment(id: string, sourceIndex: number, startSeconds: number, confidence: number): BestMoment {
  return {
    id,
    timestampLabel: "",
    startSeconds,
    endSeconds: startSeconds + 1,
    confidence,
    reason: "",
    sourceIndex,
  };
}

describe("planReelSegments", () => {
  it("does not pick multiple moments clustered a few seconds apart from the same long continuous source", () => {
    // Source 0: a 90s continuous drone orbit with FIVE high-confidence
    // moments all clustered within a 12-second window (the "beautiful part"
    // of the orbit) — exactly the shape of footage that produced repeats.
    const clusteredSource: BestMoment[] = [
      moment("s0-a", 0, 40, 96),
      moment("s0-b", 0, 42, 95),
      moment("s0-c", 0, 44, 94),
      moment("s0-d", 0, 46, 93),
      moment("s0-e", 0, 48, 92),
    ];
    // Two other sources with plenty of well-spread moments so the reel
    // doesn't have to lean on source 0 to hit its target length.
    const otherSources: BestMoment[] = [];
    for (let s = 1; s <= 2; s++) {
      for (let i = 0; i < 6; i++) {
        otherSources.push(moment(`s${s}-${i}`, s, i * 10, 80 - i));
      }
    }

    const bestMoments = [...clusteredSource, ...otherSources];
    const videoDurations = [90, 70, 70];
    const recipe = STYLE_RECIPES.viral;

    const segments: Segment[] = planReelSegments(bestMoments, recipe, videoDurations, 60);

    const source0Picks = segments.filter((s) => s.sourceIndex === 0);
    // At most one moment should have been kept from the clustered 12s window
    // on source 0 — picking 2+ from that tight cluster is the bug.
    expect(source0Picks.length).toBeLessThanOrEqual(1);
  });

  it("still selects multiple moments from the same source when they are genuinely spread out", () => {
    const spreadSource: BestMoment[] = [
      moment("wide-a", 0, 5, 96),
      moment("wide-b", 0, 45, 95),
      moment("wide-c", 0, 85, 94),
    ];
    const bestMoments = [...spreadSource];
    const videoDurations = [120];
    const recipe = STYLE_RECIPES.viral;

    const segments: Segment[] = planReelSegments(bestMoments, recipe, videoDurations, 60);
    expect(segments.length).toBeGreaterThan(1);
  });
});
