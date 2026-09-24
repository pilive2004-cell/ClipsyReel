import { describe, expect, it } from "vitest";
import { summarizeOpenCvMetrics } from "@/lib/opencv-analysis";

describe("summarizeOpenCvMetrics", () => {
  it("computes motion, scene change, and stability from sampled frame values", () => {
    const summary = summarizeOpenCvMetrics([
      { brightness: 0.4, contrast: 0.35, sharpness: 0.6, motion: 0.1 },
      { brightness: 0.5, contrast: 0.42, sharpness: 0.8, motion: 0.6 },
      { brightness: 0.55, contrast: 0.48, sharpness: 0.7, motion: 0.45 },
    ]);

    expect(summary.frameMetrics).toHaveLength(3);
    expect(summary.averageMotion).toBeGreaterThanOrEqual(0);
    expect(summary.averageMotion).toBeLessThanOrEqual(1);
    expect(summary.averageStability).toBeGreaterThanOrEqual(0);
    expect(summary.averageStability).toBeLessThanOrEqual(1);
  });
});
