import { describe, expect, it } from "vitest";
import { getComposeClipCap, planReelSegments, shouldUseCompactConcatFallback, type Segment } from "../video-engine";
import { buildSportHookSequence, planSportHookWindows } from "../sport-style";
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

  it("sport mode does not stop at four clips when only one source is available", () => {
    const sourceMoments: BestMoment[] = [
      moment("sport-a", 0, 8, 95),
      moment("sport-b", 0, 22, 94),
      moment("sport-c", 0, 36, 93),
      moment("sport-d", 0, 50, 92),
    ];
    const recipe = STYLE_RECIPES.sport;
    const segments: Segment[] = planReelSegments(sourceMoments, recipe, [95], 50);
    expect(segments.length).toBeGreaterThan(4);
  });

  it("sport mode can plan a near-minute reel when enough footage is available", () => {
    const sourceMoments: BestMoment[] = [];
    for (let sourceIndex = 0; sourceIndex < 3; sourceIndex++) {
      for (let i = 0; i < 8; i++) {
        sourceMoments.push(moment(`sport-${sourceIndex}-${i}`, sourceIndex, 8 + i * 12, 96 - i));
      }
    }

    const recipe = STYLE_RECIPES.sport;
    const segments: Segment[] = planReelSegments(sourceMoments, recipe, [120, 120, 120], 60);
    const plannedDuration = segments.reduce((sum, segment) => sum + segment.length / recipe.speed, 0);

    expect(plannedDuration).toBeGreaterThanOrEqual(50);
  });

  it("sport mode backfills sparse best-moment analysis so the reel does not stop around thirty seconds", () => {
    const sparseMoments: BestMoment[] = [
      moment("sport-0-a", 0, 10, 96),
      moment("sport-0-b", 0, 46, 94),
      moment("sport-1-a", 1, 18, 95),
      moment("sport-1-b", 1, 54, 93),
      moment("sport-2-a", 2, 26, 92),
    ];

    const recipe = STYLE_RECIPES.sport;
    const segments: Segment[] = planReelSegments(sparseMoments, recipe, [120, 120, 120], 60);
    const plannedDuration = segments.reduce((sum, segment) => sum + segment.length / recipe.speed, 0);

    expect(segments.length).toBeGreaterThanOrEqual(10);
    expect(plannedDuration).toBeGreaterThanOrEqual(45);
  });

  it("uses the compact concat path for sport reels as soon as three clips are in play", () => {
    expect(shouldUseCompactConcatFallback("sport", 3)).toBe(true);
    expect(shouldUseCompactConcatFallback("sport", 2)).toBe(false);
    expect(shouldUseCompactConcatFallback("viral", 7)).toBe(false);
    expect(shouldUseCompactConcatFallback("viral", 8)).toBe(true);
  });

  it("does not trim compact sport renders back down to five final clips", () => {
    expect(getComposeClipCap("sport", 3)).toBeNull();
    expect(getComposeClipCap("sport", 12)).toBeNull();
    expect(getComposeClipCap("sport", 2)).toBe(5);
    expect(getComposeClipCap("viral", 7)).toBe(6);
  });

  it("keeps the sport hook wording user-driven and strips extra editorial labels", () => {
    const beats = buildSportHookSequence({
      routeLabel: "Bergwerk Stage",
      gpxStats: { distanceKm: 42.3, elevationGainM: 1890, highestPointM: 2140, durationLabel: "1h 18m", avgSpeedKmh: 32 },
      sportTelemetry: { distanceKm: 42.3, elevationGainM: 1890, highestPointM: 2140, durationLabel: "1h 18m", maxSpeedKmh: 88 },
      fallbackText: "",
    });

    expect(beats.length).toBeGreaterThanOrEqual(3);
    beats.forEach((beat) => {
      expect(beat.title.trim().length).toBeGreaterThan(0);
      expect(beat.label.trim()).toBe("");
      expect(beat.subtitle.trim()).toBe("");
      expect(beat.text.trim().length).toBeGreaterThan(0);
      expect(beat.text.toUpperCase()).not.toContain("LIVE SPORT");
      expect(beat.text.toUpperCase()).not.toContain("ACTION BLOCK");
    });
  });

  it("uses all three custom sport hook texts instead of collapsing to one", () => {
    const beats = buildSportHookSequence({
      routeLabel: "Bergwerk Stage",
      customTexts: ["Launch hard", "Hold the line", "No brake"],
      fallbackText: "Fallback text",
    });

    expect(beats.map((beat) => beat.title)).toEqual(["Launch hard", "Hold the line", "No brake"]);
    expect(beats.every((beat) => beat.label === "")).toBe(true);
    expect(beats.every((beat) => beat.subtitle === "")).toBe(true);
  });

  it("keeps the three sport hook slots within the visible window instead of letting the final card fall outside the reel", () => {
    const beats = buildSportHookSequence({
      customTexts: ["Launch hard", "Hold the line", "No brake"],
      fallbackText: "Fallback text",
    });
    const windows = planSportHookWindows(beats, 12, 0.8, 0.9);

    expect(windows).toHaveLength(3);
    expect(windows[0].start).toBeGreaterThanOrEqual(0.08);
    expect(windows.at(-1)?.end).toBeLessThanOrEqual(11.0);
    expect(windows.every((window) => window.end > window.start)).toBe(true);
  });

  it("gives the first sport hook card enough lead-in for its full intro animation", () => {
    const beats = buildSportHookSequence({
      customTexts: ["Launch hard", "Hold the line", "No brake"],
      fallbackText: "Fallback text",
    });
    const windows = planSportHookWindows(beats, 6, 0, 0);

    expect(windows).toHaveLength(3);
    expect(windows[0]?.start).toBeGreaterThanOrEqual(0.36);
  });

  it("spreads sport hook cards across the reel after the title window instead of stacking them at the start", () => {
    const beats = buildSportHookSequence({
      customTexts: ["Launch hard", "Hold the line", "No brake"],
      overlayColors: ["gold", "cyan", "red"],
      fallbackText: "Fallback text",
    });
    const windows = planSportHookWindows(beats, 12, 0, 0, 2.8);

    expect(windows).toHaveLength(3);
    expect(windows[0]?.start).toBeGreaterThanOrEqual(2.8);
    expect(windows[1]?.start).toBeGreaterThanOrEqual(windows[0]?.end ?? 0);
    expect(windows[2]?.start).toBeGreaterThan(6);
    expect(beats.map((beat) => beat.color)).toEqual(["gold", "cyan", "red"]);
  });

  it("keeps each sport hook on screen long enough to read on shorter reels", () => {
    const beats = buildSportHookSequence({
      customTexts: ["Launch hard", "Hold the line", "No brake"],
      fallbackText: "Fallback text",
    });
    const windows = planSportHookWindows(beats, 8.8, 0, 0, 2.65);

    expect(windows).toHaveLength(3);
    expect(windows.every((window) => window.end - window.start >= 1.8)).toBe(true);
    expect(windows[1]?.start).toBeGreaterThanOrEqual(windows[0]?.end ?? 0);
  });
});
