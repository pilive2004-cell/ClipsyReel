import { describe, expect, it } from "vitest";
import { estimateAnalysisBudgetMs } from "../video-analysis";

describe("estimateAnalysisBudgetMs", () => {
  it("keeps a sensible minimum budget for short uploads", () => {
    expect(estimateAnalysisBudgetMs([{ durationSeconds: 12 }])).toBeGreaterThanOrEqual(35000);
  });

  it("allocates more budget for multi-video uploads", () => {
    const single = estimateAnalysisBudgetMs([{ durationSeconds: 40 }]);
    const multi = estimateAnalysisBudgetMs([
      { durationSeconds: 40 },
      { durationSeconds: 40 },
      { durationSeconds: 40 },
    ]);

    expect(multi).toBeGreaterThan(single);
  });

  it("caps the analysis budget to avoid unbounded waits", () => {
    expect(
      estimateAnalysisBudgetMs([
        { durationSeconds: 240 },
        { durationSeconds: 240 },
        { durationSeconds: 240 },
      ])
    ).toBeLessThanOrEqual(120000);
  });
});
