import { describe, expect, it } from "vitest";

import { buildViralRemotionTransitionMarkers } from "../video-engine";

describe("buildViralRemotionTransitionMarkers", () => {
  it("anchors viral transition markers to real overlapped cut boundaries", () => {
    const markers = buildViralRemotionTransitionMarkers({
      clipDurations: [2, 2, 2],
      transitionDurations: [0.5, 0.5],
      transitionDecisions: [
        { remotionType: "film-burn", direction: "left", durationSeconds: 0.5 },
        { remotionType: "cross-zoom", direction: "right", durationSeconds: 0.5 },
      ],
    });

    expect(markers).toEqual([
      { atSeconds: 2, type: "film-burn", direction: "left", durationFrames: 15 },
      { atSeconds: 4, type: "cross-zoom", direction: "right", durationFrames: 15 },
    ]);
  });

  it("ignores intro and outro boundaries when building viral remotion markers", () => {
    const markers = buildViralRemotionTransitionMarkers({
      clipDurations: [3, 2, 2, 2, 1],
      transitionDurations: [0.4, 0.5, 0.45, 0.35],
      transitionDecisions: [
        { remotionType: "film-burn", direction: "left", durationSeconds: 0.5 },
        { remotionType: "cross-zoom", direction: "right", durationSeconds: 0.45 },
      ],
      contentStartIndex: 1,
      contentClipCount: 3,
    });

    expect(markers).toEqual([
      { atSeconds: 5, type: "film-burn", direction: "left", durationFrames: 15 },
      { atSeconds: 7, type: "cross-zoom", direction: "right", durationFrames: 14 },
    ]);
  });
});
