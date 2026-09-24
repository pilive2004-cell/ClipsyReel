import { describe, expect, it } from "vitest";
import {
  resolveReelTitleColorValue,
  resolveReelTitleFontFamily,
  resolveReelTitleFontStyle,
  resolveReelTitleFontWeight,
  resolveReelTitleLetterSpacing,
  resolveReelTitleSizeScale,
  resolveReelTitleTextTransform,
} from "@/lib/reel-title-style";

describe("reel title style helpers", () => {
  it("maps colors to export-safe values", () => {
    expect(resolveReelTitleColorValue("gold")).toBe("#fcd34d");
    expect(resolveReelTitleColorValue("white")).toBe("#ffffff");
  });

  it("preserves typography emphasis choices", () => {
    expect(resolveReelTitleFontStyle("cinematic")).toBe("italic");
    expect(resolveReelTitleFontWeight("impact")).toBe(800);
    expect(resolveReelTitleTextTransform("impact")).toBe("uppercase");
    expect(resolveReelTitleLetterSpacing("minimal")).toBe("0.12em");
    expect(resolveReelTitleFontFamily("mono")).toContain("monospace");
  });

  it("keeps title size ordering stable", () => {
    expect(resolveReelTitleSizeScale("sm")).toBeLessThan(resolveReelTitleSizeScale("md"));
    expect(resolveReelTitleSizeScale("md")).toBeLessThan(resolveReelTitleSizeScale("lg"));
  });
});
