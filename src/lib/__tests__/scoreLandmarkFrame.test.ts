import { describe, expect, it } from "vitest";
import { scoreLandmarkFrame } from "../object-detection";

describe("scoreLandmarkFrame", () => {
  it("returns a zero score when no predictions are given", () => {
    expect(scoreLandmarkFrame(null)).toEqual({ score: 0, topLabel: null });
    expect(scoreLandmarkFrame(undefined)).toEqual({ score: 0, topLabel: null });
    expect(scoreLandmarkFrame([])).toEqual({ score: 0, topLabel: null });
  });

  it("returns a zero score when no prediction matches a known landmark keyword", () => {
    const result = scoreLandmarkFrame([
      { className: "laptop, notebook", probability: 0.9 },
      { className: "coffee mug", probability: 0.6 },
    ]);
    expect(result.score).toBe(0);
    expect(result.topLabel).toBeNull();
  });

  it("scores a real ImageNet landmark class (multi-synonym label) as a match", () => {
    const result = scoreLandmarkFrame([{ className: "cliff, drop, drop-off", probability: 0.8 }]);
    expect(result.topLabel).toBe("cliff");
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("picks the highest-scoring prediction among several candidates", () => {
    const result = scoreLandmarkFrame([
      { className: "seashore, coast, seacoast, sea-coast", probability: 0.4 }, // weight 0.75
      { className: "castle", probability: 0.7 }, // weight 1 -> higher combined score
      { className: "valley, vale", probability: 0.3 }, // weight 0.7
    ]);
    expect(result.topLabel).toBe("castle");
    expect(result.score).toBeCloseTo(0.7, 5);
  });

  it("matches multi-word landmark classes like 'triumphal arch' and 'suspension bridge'", () => {
    expect(scoreLandmarkFrame([{ className: "triumphal arch", probability: 0.5 }]).topLabel).toBe("triumphal arch");
    expect(scoreLandmarkFrame([{ className: "suspension bridge", probability: 0.5 }]).topLabel).toBe("suspension bridge");
  });

  it("is case-insensitive", () => {
    const result = scoreLandmarkFrame([{ className: "CASTLE", probability: 0.5 }]);
    expect(result.topLabel).toBe("castle");
    expect(result.score).toBeGreaterThan(0);
  });
});
