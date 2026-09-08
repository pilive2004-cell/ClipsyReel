import type { Rule } from "../types";
import { computeClipEnergy, recalculateTimeline } from "../timeline-helpers";

/**
 * Re-orders the pre-climax run into a clearer energy climb so the payoff has
 * something to rise out of instead of feeling randomly placed.
 */
export function createProgressiveIntensityRule(): Rule {
  return {
    id: "progressive-intensity",
    description: "Shapes the lead-up to the climax so energy trends upward.",
    apply(context) {
      const clips = [...context.timeline.clips];
      const climaxIndex = clips.findIndex((clip) => clip.storyPhase === "climax");
      if (climaxIndex <= 1) return context;

      const head = clips.slice(0, 1);
      const middle = clips.slice(1, climaxIndex).sort((a, b) => computeClipEnergy(a.scores) - computeClipEnergy(b.scores) || a.momentId.localeCompare(b.momentId));
      const tail = clips.slice(climaxIndex);
      const reordered = [...head, ...middle, ...tail];
      const changed = reordered.some((clip, index) => clip.momentId !== clips[index]?.momentId);
      if (!changed) return context;

      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips: reordered }),
        notes: [...context.notes, "Rule applied: progressive intensity toward the climax."],
      };
    },
  };
}

export const progressiveIntensityRule = createProgressiveIntensityRule();
