import type { Rule } from "../types";
import { recalculateTimeline } from "../timeline-helpers";

/**
 * Moves the strongest quality beat to the final image when it is not already
 * there, because the last frame is what viewers remember most.
 */
export function createEndOnStrongestSceneRule(): Rule {
  return {
    id: "end-on-strongest-scene",
    description: "Ensures the last clip is the highest-quality scene.",
    apply(context) {
      const clips = [...context.timeline.clips];
      if (clips.length <= 1) return context;
      const strongestIndex = clips.reduce((bestIndex, clip, index, allClips) =>
        clip.scores.QualityScore > allClips[bestIndex].scores.QualityScore ||
        (clip.scores.QualityScore === allClips[bestIndex].scores.QualityScore && clip.momentId.localeCompare(allClips[bestIndex].momentId) < 0)
          ? index
          : bestIndex,
      0);
      const endingIndex = clips.length - 1;
      if (strongestIndex === endingIndex) return context;

      const displaced = clips[endingIndex];
      const strongest = clips[strongestIndex];
      clips[strongestIndex] = { ...displaced, storyPhase: displaced.storyPhase === "ending" ? "build_up" : displaced.storyPhase };
      clips[endingIndex] = { ...strongest, storyPhase: "ending", emphasis: "highlight", notes: [...strongest.notes, "Moved to the final position as the strongest scene."] };

      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips }),
        notes: [...context.notes, "Rule applied: ended on the strongest scene."],
      };
    },
  };
}

export const endOnStrongestSceneRule = createEndOnStrongestSceneRule();
