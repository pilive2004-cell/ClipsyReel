import { describe, expect, it } from "vitest";

import { buildRemotionPlanFromMoments } from "../index";
import type { BestMoment } from "@/types";

const moments: BestMoment[] = [
  {
    id: "m1",
    timestampLabel: "00:00 - 00:02",
    startSeconds: 0,
    endSeconds: 2,
    confidence: 90,
    reason: "Strong opening",
    sourceIndex: 0,
    scoreBreakdown: { retention: 0.8, motion: 0.9, visualImpact: 0.92, clarity: 0.7, gpxContext: 0.4, emotion: 0.6, motionIntensity: 0.92, sceneChange: 0.84, brightness: 0.6, contrast: 0.72, sharpness: 0.7, stability: 0.3 },
  },
  {
    id: "m2",
    timestampLabel: "00:02 - 00:04",
    startSeconds: 2,
    endSeconds: 4,
    confidence: 78,
    reason: "Pacing",
    sourceIndex: 0,
    scoreBreakdown: { retention: 0.7, motion: 0.62, visualImpact: 0.68, clarity: 0.72, gpxContext: 0.4, emotion: 0.5, motionIntensity: 0.58, sceneChange: 0.48, brightness: 0.58, contrast: 0.52, sharpness: 0.7, stability: 0.46 },
  },
  {
    id: "m3",
    timestampLabel: "00:04 - 00:06",
    startSeconds: 4,
    endSeconds: 6,
    confidence: 66,
    reason: "Breathing room",
    sourceIndex: 1,
    scoreBreakdown: { retention: 0.55, motion: 0.28, visualImpact: 0.34, clarity: 0.7, gpxContext: 0.4, emotion: 0.52, motionIntensity: 0.24, sceneChange: 0.22, brightness: 0.54, contrast: 0.44, sharpness: 0.68, stability: 0.82 },
  },
];

describe("buildRemotionPlanFromMoments", () => {
  it("builds a viral plan with beat markers, transitions, and overlays", () => {
    const plan = buildRemotionPlanFromMoments(moments, "viral", undefined, {
      title: "Ride faster",
      hookText: "Open hard. Cut fast.",
      overlayTexts: ["Whip pan", "Speed ramp"],
    }, {
      editingSeed: "viral-seed-42",
      renderCreativityLevel: "HIGH",
      viralStyleDNA: "CAPCUT_TRENDING",
      generateVersions: 4,
    });

    expect(plan.style).toBe("viral");
    expect(plan.clips).toHaveLength(3);
    expect(plan.beatMarkers.length).toBe(plan.clips.length);
    expect(plan.transitions).toHaveLength(2);
    expect(plan.overlayTexts).toEqual(["Whip pan", "Speed ramp"]);
    expect(plan.graphics.some((graphic) => graphic.type === "progress")).toBe(true);
    expect(plan.averageShotLength).toBeGreaterThanOrEqual(0.5);
    expect(plan.variability?.seed).toBe("viral-seed-42");
    expect(plan.variability?.selectedVersion.transitions.length).toBe(2);
    expect(plan.clips[0]?.cameraMove).toBeTruthy();
  });
});
