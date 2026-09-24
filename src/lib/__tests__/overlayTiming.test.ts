import { describe, expect, it } from "vitest";

import { planOverlayTextWindows, planReelTitleWindow } from "../video-engine";
import {
  resolveViralHookLowerThirdLayout,
  splitViralHookLowerThirdText,
} from "../../modules/remotion/graphics/viral-hook-lower-third";

function createMockTextMeasurer() {
  let currentFont = "800 40px Inter";
  return {
    get font() {
      return currentFont;
    },
    set font(value: string) {
      currentFont = value;
    },
    measureText(text: string) {
      const match = currentFont.match(/(\d+(?:\.\d+)?)px/);
      const fontSize = Number(match?.[1] ?? 40);
      return { width: text.length * fontSize * 0.58 } as TextMetrics;
    },
  };
}

describe("overlay timing", () => {
  it("keeps a short non-sport title window compact enough to leave room for hooks", () => {
    const titleWindow = planReelTitleWindow(3.2, 0, 0, "travel");

    expect(titleWindow).not.toBeNull();
    expect((titleWindow?.end ?? 0) - (titleWindow?.start ?? 0)).toBeLessThanOrEqual(0.95);
  });

  it("shows at least one hook on a very short non-sport reel", () => {
    const titleWindow = planReelTitleWindow(3.2, 0, 0, "travel");
    const windows = planOverlayTextWindows(
      ["Hook 1", "Hook 2", "Hook 3"],
      3.2,
      0,
      0,
      (titleWindow?.end ?? 0) + 0.35,
      "travel",
    );

    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((window) => window.end > window.start)).toBe(true);
    expect(windows.at(-1)?.end ?? 0).toBeLessThanOrEqual(2.85);
  });

  it("still preserves all three hooks when the reel is long enough", () => {
    const titleWindow = planReelTitleWindow(12, 0, 0, "travel");
    const windows = planOverlayTextWindows(
      ["Hook 1", "Hook 2", "Hook 3"],
      12,
      0,
      0,
      (titleWindow?.end ?? 0) + 0.35,
      "travel",
    );

    expect(windows).toHaveLength(3);
  });

  it("keeps viral hooks at or after the 24s mark when requested", () => {
    const windows = planOverlayTextWindows(["Hook 1", "Hook 2"], 90, 0, 0, 24, "viral");

    expect(windows[0]?.start ?? 0).toBeGreaterThanOrEqual(24);
  });

  it("splits long viral hooks into distinct blue and black lines", () => {
    const { primary, secondary } = splitViralHookLowerThirdText("Alignment meeting with DE-5, 30 June");

    expect(primary).toBeTruthy();
    expect(secondary).toBeTruthy();
    expect(primary).not.toEqual(secondary);
  });

  it("shrinks the hook typography and box width as text gets longer", () => {
    const shortLayout = resolveViralHookLowerThirdLayout("BMW M", createMockTextMeasurer(), 1008);
    const longLayout = resolveViralHookLowerThirdLayout(
      "Alignment meeting with DE-5, 30 June",
      createMockTextMeasurer(),
      1008
    );

    expect(shortLayout.fontSize).toBeGreaterThan(longLayout.fontSize);
    expect(shortLayout.barWidth).toBeGreaterThan(longLayout.barWidth);
    expect(shortLayout.barWidth).toBeGreaterThanOrEqual(900);
  });
});
