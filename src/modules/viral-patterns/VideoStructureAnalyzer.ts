/**
 * VideoStructureAnalyzer — MVP heuristic stub.
 *
 * Real computer-vision shot-boundary detection is out of scope for the MVP
 * (per product spec §14). This module only reads the local file's playable
 * duration and derives *plausible* structural stats from it, deterministically
 * seeded by the file's name/size so re-analysis is stable. Replace the body
 * of `analyzeStructure` with real shot-detection (e.g. frame-difference /
 * scene-cut detection) later — the `VideoStructureAnalysis` output shape can
 * stay the same.
 */
import { EndingType, VideoStructureAnalysis } from "./types";
import { hashSeed, makeSeededRandom, readVideoDurationSeconds } from "./internal/seed";

const ENDING_TYPES: EndingType[] = ["loop", "reveal", "fade", "hard_cut", "hero_shot"];

export async function analyzeStructure(file: File): Promise<VideoStructureAnalysis> {
  const totalDurationSeconds = await readVideoDurationSeconds(file);
  const rng = makeSeededRandom(hashSeed(`${file.name}:${file.size}`));

  // Plausible average shot duration for social-first edits: ~0.8s to ~2.2s.
  const averageShotDuration = 0.8 + rng() * 1.4;
  const shotCount = Math.max(3, Math.round(totalDurationSeconds / averageShotDuration));
  const shotDurationVariation = 0.2 + rng() * 0.6;
  const cutsPerSecond = shotCount / totalDurationSeconds;

  const climaxPositionSeconds = Math.round(totalDurationSeconds * (0.55 + rng() * 0.25) * 10) / 10;

  const energyTimeline = buildEnergyTimeline(totalDurationSeconds, climaxPositionSeconds, rng);
  const slowMoments = findMomentsBelow(energyTimeline, 45);
  const accelerationMoments = findMomentsAbove(energyTimeline, 80).filter((m) => m.startSeconds < climaxPositionSeconds);

  return {
    totalDurationSeconds: Math.round(totalDurationSeconds * 10) / 10,
    shotCount,
    averageShotDuration: Math.round(averageShotDuration * 100) / 100,
    shotDurationVariation: Math.round(shotDurationVariation * 100) / 100,
    cutsPerSecond: Math.round(cutsPerSecond * 100) / 100,
    slowMoments,
    accelerationMoments,
    energyTimeline,
    climaxPositionSeconds,
    endingType: ENDING_TYPES[Math.floor(rng() * ENDING_TYPES.length)],
  };
}

function buildEnergyTimeline(duration: number, climaxAt: number, rng: () => number): Array<{ time: number; energy: number }> {
  const steps = Math.max(6, Math.min(30, Math.round(duration)));
  const points: Array<{ time: number; energy: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const time = Math.round(((duration * i) / steps) * 10) / 10;
    const distanceFromClimax = Math.abs(time - climaxAt) / duration;
    const base = 100 - distanceFromClimax * 90;
    const noise = (rng() - 0.5) * 15;
    points.push({ time, energy: Math.max(20, Math.min(100, Math.round(base + noise))) });
  }
  return points;
}

function findMomentsBelow(timeline: Array<{ time: number; energy: number }>, threshold: number) {
  return collectRuns(timeline, (e) => e < threshold);
}

function findMomentsAbove(timeline: Array<{ time: number; energy: number }>, threshold: number) {
  return collectRuns(timeline, (e) => e > threshold);
}

function collectRuns(
  timeline: Array<{ time: number; energy: number }>,
  predicate: (energy: number) => boolean
): Array<{ startSeconds: number; endSeconds: number }> {
  const runs: Array<{ startSeconds: number; endSeconds: number }> = [];
  let runStart: number | null = null;
  timeline.forEach((point, i) => {
    const matches = predicate(point.energy);
    if (matches && runStart == null) runStart = point.time;
    const isLast = i === timeline.length - 1;
    if ((!matches || isLast) && runStart != null) {
      runs.push({ startSeconds: runStart, endSeconds: matches && isLast ? point.time : timeline[Math.max(0, i - 1)].time });
      runStart = null;
    }
  });
  return runs;
}
