import { describe, expect, it } from "vitest";

import { planOverlayTextWindows, planReelTitleWindow } from "../video-engine";

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
});
