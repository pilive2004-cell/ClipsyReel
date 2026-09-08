/**
 * EmotionalCurveExtractor — converts a video's structure + hook analysis
 * into an abstract `EmotionalCurve` (hook / orientation / build_up /
 * surprise / climax / breathing_moment / premium_ending).
 */
import { EmotionalCurve, HookAnalysis, VideoStructureAnalysis } from "./types";

export function extractEmotionalCurve(structure: VideoStructureAnalysis, hook: HookAnalysis): EmotionalCurve {
  const total = structure.totalDurationSeconds;
  const climax = structure.climaxPositionSeconds;

  const hookEnd = Math.min(3, total * 0.15);
  const orientationEnd = Math.min(hookEnd + total * 0.15, climax - total * 0.1);
  const buildUpEnd = Math.max(orientationEnd + 0.5, climax - 0.5);
  const climaxEnd = Math.min(total, climax + total * 0.15);
  const breathingEnd = Math.min(total, climaxEnd + total * 0.1);

  const segments = [
    { phase: "hook" as const, start: 0, end: round(hookEnd), energy: hook.hookScore },
    { phase: "orientation" as const, start: round(hookEnd), end: round(orientationEnd), energy: 55 },
    { phase: "build_up" as const, start: round(orientationEnd), end: round(buildUpEnd), energy: 72 },
    { phase: "climax" as const, start: round(buildUpEnd), end: round(climaxEnd), energy: 100 },
    { phase: "breathing_moment" as const, start: round(climaxEnd), end: round(breathingEnd), energy: 48 },
    { phase: "premium_ending" as const, start: round(breathingEnd), end: total, energy: 68 },
  ].filter((s) => s.end > s.start);

  return {
    curveType: hook.hookScore >= 80 ? "Fast Adventure Build-Up" : "Balanced Adventure Curve",
    segments,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
