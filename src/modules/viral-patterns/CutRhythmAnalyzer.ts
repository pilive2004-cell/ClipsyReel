/**
 * CutRhythmAnalyzer — MVP heuristic stub.
 *
 * Builds an abstract `CutRhythmTimeline` (the `{ time, type, energy,
 * shotDuration }[]` structure from the product spec) from the structure
 * analysis' energy timeline. Real editing-technique classification (jump
 * cuts, match cuts, whip transitions, beat cuts, speed ramps, freeze
 * moments, flash transitions) requires frame-level computer vision and is
 * a later upgrade — for now, counts are estimated heuristically from shot
 * count and energy variation so the rest of the pipeline has real numbers
 * to work with.
 */
import { CutRhythmTimeline, TimelineEvent, TimelineEventType, VideoStructureAnalysis } from "./types";
import { hashSeed, makeSeededRandom } from "./internal/seed";

export function analyzeCutRhythm(file: File, structure: VideoStructureAnalysis): CutRhythmTimeline {
  const rng = makeSeededRandom(hashSeed(`rhythm:${file.name}:${file.size}`));

  const events: TimelineEvent[] = structure.energyTimeline.map((point, i) => ({
    time: point.time,
    type: eventTypeFor(point.energy, i, structure.energyTimeline.length),
    energy: point.energy,
    shotDuration: Math.max(0.3, structure.averageShotDuration + (rng() - 0.5) * structure.shotDurationVariation),
  }));

  const shortShots = events.filter((e) => e.shotDuration < 0.7).length;
  const longShots = events.filter((e) => e.shotDuration > 2.5).length;
  const fastCutRatio = shortShots / events.length;
  const slowCutRatio = longShots / events.length;

  const climaxIndex = events.reduce((best, e, i, arr) => (e.energy > arr[best].energy ? i : best), 0);
  const hasAccelerationBeforeClimax =
    climaxIndex > 1 && events[climaxIndex - 1].energy > events[Math.max(0, climaxIndex - 3)].energy;

  return {
    events,
    fastCutRatio: Math.round(fastCutRatio * 100) / 100,
    slowCutRatio: Math.round(slowCutRatio * 100) / 100,
    hasProgressiveBuildUp: fastCutRatio > 0.2 && hasAccelerationBeforeClimax,
    hasAccelerationBeforeClimax,
    wideCloseAlternationScore: Math.round(40 + rng() * 50),
    breathingShotCount: Math.max(0, Math.round(structure.shotCount * (0.1 + rng() * 0.1))),
    jumpCutCount: Math.max(0, Math.round(structure.shotCount * fastCutRatio * 0.3)),
    matchCutCount: Math.max(0, Math.round(rng() * 2)),
    whipTransitionCount: Math.max(0, Math.round(rng() * 3)),
    beatCutCount: Math.max(0, Math.round(structure.shotCount * 0.2)),
    speedRampCount: Math.max(0, Math.round(rng() * 2)),
    freezeMomentCount: Math.max(0, Math.round(rng() * 1)),
    flashTransitionCount: Math.max(0, Math.round(rng() * 2)),
  };
}

function eventTypeFor(energy: number, index: number, total: number): TimelineEventType {
  if (index === 0) return "hook";
  if (index === total - 1) return "premium_end";
  if (energy >= 90) return "climax";
  if (energy >= 75) return "surprise_motion";
  if (energy >= 60) return "fast_cut";
  if (energy >= 45) return "build_up";
  if (energy >= 30) return "wide_context";
  return "breathing_shot";
}
