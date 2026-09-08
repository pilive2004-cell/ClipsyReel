/**
 * MontageRecipeGenerator — turns a `MontageRecipeInput` + the `PatternLibrary`
 * into a concrete, timed `MontageRecipe` (hook / context / build_up / climax /
 * premium_end timeline), following the structure the product spec describes.
 */
import { PatternLibrary, defaultPatternLibrary } from "./PatternLibrary";
import {
  MontagePattern,
  MontageRecipe,
  MontageRecipeInput,
  MontageRecipeSegment,
  SegmentType,
  ShotType,
  TransitionType,
} from "./types";

/** Proportional share of total duration for each of the 5 structural segments. */
const SEGMENT_RATIOS: Array<{ type: SegmentType; ratio: number }> = [
  { type: "hook", ratio: 0.08 },
  { type: "context", ratio: 0.12 },
  { type: "build_up", ratio: 0.27 },
  { type: "climax", ratio: 0.27 },
  { type: "premium_end", ratio: 0.26 },
];

/** Baseline energy target per segment, before scaling by the requested energy level. */
const BASE_ENERGY: Record<SegmentType, number> = {
  hook: 92,
  context: 62,
  build_up: 78,
  climax: 100,
  premium_end: 75,
};

const ENERGY_SCALE: Record<MontageRecipeInput["desiredEnergy"], number> = {
  calm: 0.65,
  balanced: 0.85,
  dynamic: 1.0,
  extreme: 1.1,
};

function shotTypeFor(segment: SegmentType, pattern: MontagePattern, input: MontageRecipeInput): ShotType {
  switch (segment) {
    case "hook":
      return pattern.hookStyle.preferredShot;
    case "context":
      return input.gpxAvailable ? "wide_route_or_map" : "breathing_wide_shot";
    case "build_up":
      return "alternating_pov_and_landscape";
    case "climax":
      return "highest_scoring_moment";
    case "premium_end":
      return "hero_shot_or_arrival";
  }
}

/** Picks a transition for a segment's outgoing cut, cycling through the
 * pattern's transition vocabulary so consecutive segments don't repeat. */
function transitionFor(index: number, pattern: MontagePattern, isLast: boolean): TransitionType {
  if (isLast) {
    return pattern.transitionStyle.includes("loopable_end") ? "loopable_end" : pattern.transitionStyle[pattern.transitionStyle.length - 1];
  }
  const pool = pattern.transitionStyle.filter((t) => t !== "loopable_end");
  if (pool.length === 0) return "direct_cut";
  return pool[index % pool.length];
}

function openingStrategyFor(pattern: MontagePattern, input: MontageRecipeInput): string {
  if (input.style === "cinematic") return "slow_reveal_hook";
  if (pattern.hookStyle.minHookScore >= 80) return "strong_visual_hook";
  return "context_first_hook";
}

export class MontageRecipeGenerator {
  constructor(private library: PatternLibrary = defaultPatternLibrary) {}

  generate(input: MontageRecipeInput): MontageRecipe {
    const pattern = this.library.bestMatch({
      videoType: input.videoType,
      energy: input.desiredEnergy,
      durationSeconds: input.desiredDurationSeconds,
    });
    if (!pattern) {
      throw new Error("MontageRecipeGenerator: pattern library is empty, cannot generate a recipe.");
    }
    return this.buildRecipe(input, pattern);
  }

  /** Same as `generate`, but lets a caller (e.g. PatternMixer) force a specific base pattern. */
  buildRecipe(input: MontageRecipeInput, pattern: MontagePattern): MontageRecipe {
    const totalDuration = input.desiredDurationSeconds;
    const energyScale = ENERGY_SCALE[input.desiredEnergy];

    let cursor = 0;
    const timeline: MontageRecipeSegment[] = SEGMENT_RATIOS.map((slot, index) => {
      const segmentDuration = Math.round(totalDuration * slot.ratio * 10) / 10;
      const start = Math.round(cursor * 10) / 10;
      const end = index === SEGMENT_RATIOS.length - 1 ? totalDuration : Math.round((cursor + segmentDuration) * 10) / 10;
      cursor = end;

      const energy = Math.max(30, Math.min(100, Math.round(BASE_ENERGY[slot.type] * energyScale)));

      return {
        start,
        end,
        segmentType: slot.type,
        shotType: shotTypeFor(slot.type, pattern, input),
        transitionOut: transitionFor(index, pattern, index === SEGMENT_RATIOS.length - 1),
        energy,
      };
    });

    const recipeName = `${capitalize(input.style)} ${pattern.name}`;
    const editingSignature = buildEditingSignature(timeline, pattern.id);

    return {
      recipeName,
      duration: totalDuration,
      openingStrategy: openingStrategyFor(pattern, input),
      timeline,
      basePatternIds: [pattern.id],
      editingSignature,
    };
  }
}

/** Deterministic short signature capturing the variation choices of a recipe —
 * used by PatternMixer to detect/avoid repeating the same edit twice in a row. */
export function buildEditingSignature(timeline: MontageRecipeSegment[], patternId: string): string {
  const parts = timeline.map((seg) => `${seg.segmentType[0]}:${seg.transitionOut}:${seg.energy}`);
  return `${patternId}|${parts.join(",")}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export const defaultMontageRecipeGenerator = new MontageRecipeGenerator();
