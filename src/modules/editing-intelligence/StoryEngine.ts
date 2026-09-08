import type { EditingClipCandidate, GpxInterestingMoment, StoryAssignment, StoryPhase } from "./types";
import { stableCandidateSort } from "./timeline-helpers";

export const FULL_STORY_SEQUENCE: StoryPhase[] = [
  "hook",
  "introduction",
  "build_up",
  "action",
  "climax",
  "breathing_moment",
  "ending",
];

export const HOOK_POSITION_BIAS = 0.2;
export const INTRODUCTION_POSITION_BIAS = 0.16;
export const BUILD_UP_POSITION_BIAS = 0.14;
export const ACTION_POSITION_BIAS = 0.12;
export const CLIMAX_POSITION_BIAS = 0.2;
export const BREATHING_POSITION_BIAS = 0.18;
export const ENDING_POSITION_BIAS = 0.22;

function phaseTemplateForCount(count: number): StoryPhase[] {
  if (count <= 1) return ["hook"];
  if (count === 2) return ["hook", "ending"];
  if (count === 3) return ["hook", "climax", "ending"];
  if (count === 4) return ["hook", "build_up", "climax", "ending"];
  if (count === 5) return ["hook", "introduction", "action", "climax", "ending"];
  if (count === 6) return ["hook", "introduction", "build_up", "action", "climax", "ending"];

  const template: StoryPhase[] = ["hook", "introduction"];
  const middleSlots = count - 5;
  const buildUpSlots = Math.max(1, Math.ceil(middleSlots / 2));
  const actionSlots = Math.max(1, middleSlots - buildUpSlots);
  for (let index = 0; index < buildUpSlots; index++) template.push("build_up");
  for (let index = 0; index < actionSlots; index++) template.push("action");
  template.push("climax", "breathing_moment", "ending");
  return template;
}

function positionAffinity(slotIndex: number, totalSlots: number, targetRatio: number): number {
  const ratio = totalSlots <= 1 ? 0 : slotIndex / (totalSlots - 1);
  return Math.max(0, 1 - Math.abs(ratio - targetRatio));
}

function gpxBonus(momentId: string, gpxMoments?: readonly GpxInterestingMoment[]): number {
  if (!gpxMoments || gpxMoments.length === 0) return 0;
  const hash = momentId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const match = gpxMoments[hash % gpxMoments.length];
  return match ? match.intensity / 100 : 0;
}

function phaseScore(phase: StoryPhase, clip: EditingClipCandidate, slotIndex: number, totalSlots: number, gpxMoments?: readonly GpxInterestingMoment[]): number {
  const scores = clip.scores;
  const routeContext = gpxBonus(clip.momentId, gpxMoments);
  if (phase === "hook") {
    return scores.QualityScore * 0.32 + scores.StabilityScore * 0.24 + scores.BeautyScore * 0.2 + scores.CinematicScore * 0.12 + positionAffinity(slotIndex, totalSlots, 0.04) * 100 * HOOK_POSITION_BIAS;
  }
  if (phase === "introduction") {
    return scores.BeautyScore * 0.28 + scores.StabilityScore * 0.24 + scores.CinematicScore * 0.18 + scores.LandscapeScore * 0.18 + positionAffinity(slotIndex, totalSlots, 0.18) * 100 * INTRODUCTION_POSITION_BIAS + routeContext * 8;
  }
  if (phase === "build_up") {
    return scores.CinematicScore * 0.28 + scores.QualityScore * 0.24 + scores.EmotionScore * 0.16 + scores.MotionScore * 0.14 + scores.ActionScore * 0.1 + positionAffinity(slotIndex, totalSlots, 0.38) * 100 * BUILD_UP_POSITION_BIAS + routeContext * 6;
  }
  if (phase === "action") {
    return scores.ActionScore * 0.34 + scores.MotionScore * 0.28 + scores.QualityScore * 0.16 + scores.EmotionScore * 0.1 + positionAffinity(slotIndex, totalSlots, 0.58) * 100 * ACTION_POSITION_BIAS + routeContext * 4;
  }
  if (phase === "climax") {
    return scores.ActionScore * 0.28 + scores.QualityScore * 0.26 + scores.EmotionScore * 0.18 + scores.MotionScore * 0.14 + scores.CinematicScore * 0.08 + positionAffinity(slotIndex, totalSlots, 0.78) * 100 * CLIMAX_POSITION_BIAS + routeContext * 10;
  }
  if (phase === "breathing_moment") {
    return scores.StabilityScore * 0.3 + scores.BeautyScore * 0.24 + scores.LandscapeScore * 0.2 + (100 - scores.MotionScore) * 0.16 + positionAffinity(slotIndex, totalSlots, 0.88) * 100 * BREATHING_POSITION_BIAS + routeContext * 8;
  }
  return scores.LandscapeScore * 0.24 + scores.EmotionScore * 0.22 + scores.CinematicScore * 0.2 + scores.QualityScore * 0.18 + scores.BeautyScore * 0.08 + positionAffinity(slotIndex, totalSlots, 1) * 100 * ENDING_POSITION_BIAS + routeContext * 10;
}

function rationaleForPhase(phase: StoryPhase): string {
  switch (phase) {
    case "hook":
      return "Strong opening candidate: readable, confident, and immediately watchable.";
    case "introduction":
      return "Sets context before the edit starts accelerating.";
    case "build_up":
      return "Bridges calm setup into stronger movement and anticipation.";
    case "action":
      return "Raises kinetic energy before the payoff lands.";
    case "climax":
      return "Highest dramatic payoff in the narrative arc.";
    case "breathing_moment":
      return "Intentional release beat so the ending does not feel exhausting.";
    case "ending":
      return "Closing image chosen to leave a memorable final impression.";
  }
}

/**
 * Assigns clips into a monotonic story order. The same inputs always yield the
 * same arc so the module can be tested and reasoned about without hidden RNG.
 */
export function buildStory(clips: EditingClipCandidate[], gpxMoments?: readonly GpxInterestingMoment[]): StoryAssignment[] {
  const candidates = stableCandidateSort(clips);
  if (candidates.length === 0) return [];

  const template = phaseTemplateForCount(candidates.length);
  const remaining = [...candidates];
  const assignments: StoryAssignment[] = [];

  template.forEach((phase, slotIndex) => {
    const ranked = remaining
      .map((clip) => ({
        clip,
        score: phaseScore(phase, clip, slotIndex, template.length, gpxMoments),
      }))
      .sort((a, b) => b.score - a.score || a.clip.momentId.localeCompare(b.clip.momentId));
    const selected = ranked[0]?.clip;
    if (!selected) return;
    remaining.splice(remaining.findIndex((entry) => entry.momentId === selected.momentId), 1);
    assignments.push({
      momentId: selected.momentId,
      phase,
      orderIndex: assignments.length,
      scores: selected.scores,
      rationale: rationaleForPhase(phase),
      sourceIndex: selected.sourceIndex ?? null,
      sequenceIndex: selected.sequenceIndex ?? Number.MAX_SAFE_INTEGER,
    });
  });

  return assignments;
}
