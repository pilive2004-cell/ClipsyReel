import type { CSSProperties } from "react";
import type { ReelTitleColor, ReelTitleFont, ReelTitleSize } from "@/types";

export function resolveReelTitleFontFamily(font: ReelTitleFont): string {
  if (font === "classic") return `Georgia, "Times New Roman", serif`;
  if (font === "modern") return `"Inter", "Arial", "Helvetica Neue", sans-serif`;
  if (font === "bold") return `"Arial Black", "Inter", "Segoe UI", sans-serif`;
  if (font === "minimal") return `"Avenir Next", "Inter", "Helvetica Neue", sans-serif`;
  if (font === "handwritten") return `"Brush Script MT", "Snell Roundhand", "Comic Sans MS", cursive`;
  if (font === "elegant") return `"Garamond", "Baskerville", Georgia, serif`;
  if (font === "impact") return `"Impact", "Arial Black", sans-serif`;
  if (font === "mono") return `"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
  if (font === "rounded") return `"Trebuchet MS", "Avenir Next", "Segoe UI", sans-serif`;
  return `"Bodoni MT", "Didot", Georgia, serif`;
}

export function resolveReelTitleFontStyle(font: ReelTitleFont): CSSProperties["fontStyle"] {
  return font === "handwritten" || font === "elegant" || font === "cinematic" ? "italic" : "normal";
}

export function resolveReelTitleFontWeight(font: ReelTitleFont): CSSProperties["fontWeight"] {
  return font === "bold" || font === "impact" ? 800 : 600;
}

export function resolveReelTitleLetterSpacing(font: ReelTitleFont): string {
  if (font === "impact") return "-0.03em";
  if (font === "mono") return "0.06em";
  if (font === "minimal") return "0.12em";
  if (font === "cinematic") return "0.08em";
  return "0.02em";
}

export function resolveReelTitleTextTransform(font: ReelTitleFont): CSSProperties["textTransform"] {
  return font === "impact" ? "uppercase" : "none";
}

export function resolveReelTitleColorValue(color: ReelTitleColor): string {
  if (color === "gold") return "#fcd34d";
  if (color === "coral") return "#fdba74";
  if (color === "cyan") return "#67e8f9";
  if (color === "lime") return "#bef264";
  if (color === "violet") return "#c4b5fd";
  if (color === "pink") return "#f9a8d4";
  if (color === "red") return "#f87171";
  if (color === "blue") return "#60a5fa";
  if (color === "emerald") return "#6ee7b7";
  if (color === "peach") return "#fed7aa";
  if (color === "silver") return "#cbd5e1";
  return "#ffffff";
}

export function resolveReelTitleSizeScale(size: ReelTitleSize): number {
  if (size === "sm") return 0.06;
  if (size === "lg") return 0.095;
  return 0.078;
}

export function resolveReelTitlePreviewFontSize(size: ReelTitleSize): string {
  if (size === "sm") return "1rem";
  if (size === "lg") return "1.45rem";
  return "1.2rem";
}

export function resolveReelTitlePreviewPixelSize(size: ReelTitleSize): number {
  if (size === "sm") return 18;
  if (size === "lg") return 28;
  return 22;
}
