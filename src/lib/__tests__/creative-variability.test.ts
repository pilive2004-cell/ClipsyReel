import { describe, expect, it } from "vitest";

import { buildCreativeVariabilityPlan } from "@/lib/creative-variability";
import type { BestMoment } from "@/types";

const moments: BestMoment[] = [
  {
    id: "m1",
    timestampLabel: "00:00 - 00:02",
    startSeconds: 0,
    endSeconds: 2,
    confidence: 92,
    reason: "Hook",
    sourceIndex: 0,
    scoreBreakdown: { retention: 0.8, motion: 0.88, visualImpact: 0.9, clarity: 0.74, gpxContext: 0.4, emotion: 0.6, motionIntensity: 0.9, sceneChange: 0.82, brightness: 0.58, contrast: 0.72, sharpness: 0.76, stability: 0.44 },
  },
  {
    id: "m2",
    timestampLabel: "00:02 - 00:04",
    startSeconds: 2,
    endSeconds: 4,
    confidence: 78,
    reason: "Drive",
    sourceIndex: 0,
    scoreBreakdown: { retention: 0.68, motion: 0.62, visualImpact: 0.72, clarity: 0.69, gpxContext: 0.4, emotion: 0.52, motionIntensity: 0.6, sceneChange: 0.55, brightness: 0.6, contrast: 0.55, sharpness: 0.71, stability: 0.5 },
  },
  {
    id: "m3",
    timestampLabel: "00:04 - 00:06",
    startSeconds: 4,
    endSeconds: 6,
    confidence: 65,
    reason: "Breath",
    sourceIndex: 1,
    scoreBreakdown: { retention: 0.55, motion: 0.28, visualImpact: 0.34, clarity: 0.76, gpxContext: 0.4, emotion: 0.48, motionIntensity: 0.24, sceneChange: 0.2, brightness: 0.57, contrast: 0.46, sharpness: 0.69, stability: 0.84 },
  },
];

describe("buildCreativeVariabilityPlan", () => {
  it("is deterministic for the same seed", () => {
    const first = buildCreativeVariabilityPlan({
      style: "viral",
      moments,
      clipCount: 3,
      overlayCount: 2,
      settings: {
        editingSeed: "seed-123",
        renderCreativityLevel: "HIGH",
        viralStyleDNA: "TIKTOK_FAST",
        generateVersions: 4,
      },
    });
    const second = buildCreativeVariabilityPlan({
      style: "viral",
      moments,
      clipCount: 3,
      overlayCount: 2,
      settings: {
        editingSeed: "seed-123",
        renderCreativityLevel: "HIGH",
        viralStyleDNA: "TIKTOK_FAST",
        generateVersions: 4,
      },
    });

    expect(first).toEqual(second);
  });

  it("changes the selected version when the seed changes", () => {
    const first = buildCreativeVariabilityPlan({
      style: "viral",
      moments,
      clipCount: 3,
      overlayCount: 2,
      settings: {
        editingSeed: "seed-123",
        renderCreativityLevel: "EXTREME",
        viralStyleDNA: "REDBULL_ACTION",
        generateVersions: 5,
      },
    });
    const second = buildCreativeVariabilityPlan({
      style: "viral",
      moments,
      clipCount: 3,
      overlayCount: 2,
      settings: {
        editingSeed: "seed-456",
        renderCreativityLevel: "EXTREME",
        viralStyleDNA: "REDBULL_ACTION",
        generateVersions: 5,
      },
    });

    expect(first?.selectedVersion.label).not.toBe(second?.selectedVersion.label);
  });

  it("keeps viral transitions on the film-burn / cross-zoom family only", () => {
    const plan = buildCreativeVariabilityPlan({
      style: "viral",
      moments,
      clipCount: 5,
      overlayCount: 2,
      settings: {
        editingSeed: "viral-flash-guard",
        renderCreativityLevel: "HIGH",
        viralStyleDNA: "TIKTOK_FAST",
        generateVersions: 3,
      },
    });

    expect(plan).not.toBeNull();
    expect(plan?.selectedVersion.transitions.every((transition) => ["film-burn", "cross-zoom"].includes(transition.remotionType))).toBe(true);
    expect(plan?.selectedVersion.transitions.every((transition) => transition.variant !== "flash")).toBe(true);
  });
});
