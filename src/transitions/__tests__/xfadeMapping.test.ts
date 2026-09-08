import { describe, expect, it } from "vitest";
import { ALL_TRANSITION_IDS } from "@/transitions/transitionPresets";
import { FORBIDDEN_TRANSITIONS, isForbiddenXfadeTransition, mapTransitionToXfade, XFADE_MAPPING } from "@/transitions/xfadeMapping";

const VALID_XFADE_NAMES = new Set([
  "fade",
  "fadegrays",
  "zoomin",
  "fadeblack",
  "fadewhite",
  "smoothleft",
  "smoothright",
  "horzopen",
  "vertopen",
  "vertclose",
  "hlslice",
  "hrslice",
  "vdslice",
  "hblur",
  "pixelize",
  "distance",
  "circleopen",
  "circleclose",
]);

describe("xfadeMapping", () => {
  it("maps every known transition id to a valid ffmpeg xfade filter name", () => {
    for (const id of ALL_TRANSITION_IDS) {
      const mapped = mapTransitionToXfade(id);
      expect(VALID_XFADE_NAMES.has(mapped)).toBe(true);
    }
  });

  it("has no gaps between the transition library and the xfade map", () => {
    expect(Object.keys(XFADE_MAPPING).length).toBe(ALL_TRANSITION_IDS.length);
  });

  it("never maps any transition id to 'radial' (permanently banned clock-hand/compass-needle rotation effect — long-standing explicit user requirement)", () => {
    for (const id of ALL_TRANSITION_IDS) {
      expect(mapTransitionToXfade(id)).not.toBe("radial");
    }
    expect(isForbiddenXfadeTransition("radial")).toBe(true);
    expect(isForbiddenXfadeTransition("RADIAL")).toBe(true);
  });

  it("never maps any transition id to a globally forbidden xfade filter (wipe*/slide*/cover*/reveal*/rectcrop/dissolve)", () => {
    for (const id of ALL_TRANSITION_IDS) {
      const mapped = mapTransitionToXfade(id);
      expect(isForbiddenXfadeTransition(mapped)).toBe(false);
    }
  });

  it("the valid xfade filter allowlist itself contains none of the forbidden names", () => {
    for (const name of VALID_XFADE_NAMES) {
      expect(isForbiddenXfadeTransition(name)).toBe(false);
    }
  });

  it("isForbiddenXfadeTransition recognizes every entry of the global forbidden list (case-insensitively)", () => {
    for (const forbidden of FORBIDDEN_TRANSITIONS) {
      expect(isForbiddenXfadeTransition(forbidden)).toBe(true);
      expect(isForbiddenXfadeTransition(forbidden.toLowerCase())).toBe(true);
      expect(isForbiddenXfadeTransition(forbidden.toUpperCase())).toBe(true);
    }
  });
});

