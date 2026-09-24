import { describe, expect, it } from "vitest";

import { isCoherentDisplayText, isExplicitDisplayText, resolveNonSportOverlayTexts } from "../display-text";

describe("display text resolution", () => {
  it("accepts explicit short user titles that should not be treated as incoherent", () => {
    expect(isExplicitDisplayText("M5")).toBe(true);
    expect(isExplicitDisplayText("DE-5")).toBe(true);
    expect(isCoherentDisplayText("M5")).toBe(false);
  });

  it("does not duplicate the reel title inside non-sport hook overlays", () => {
    const overlays = resolveNonSportOverlayTexts({
      hookText: "Road trip through Provence",
      reelTitle: "Road trip through Provence",
      customTextOverlays: ["Road trip through Provence", "Sunset roads ahead"],
      overlayTexts: ["Road trip through Provence", "Sunset roads ahead"],
    });

    expect(overlays).toEqual(["Sunset roads ahead"]);
  });

  it("falls back to the hook only when no explicit overlay text remains", () => {
    const overlays = resolveNonSportOverlayTexts({
      hookText: "Hidden alpine roads",
      reelTitle: "Weekend Ride",
      customTextOverlays: [],
      overlayTexts: [],
    });

    expect(overlays).toEqual(["Hidden alpine roads"]);
  });
});
