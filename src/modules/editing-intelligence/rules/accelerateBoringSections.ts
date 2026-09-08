import type { Rule } from "../types";
import { recalculateTimeline } from "../timeline-helpers";

export const DEFAULT_BORING_SECTION_MAX_QUALITY_SCORE = 58;
export const DEFAULT_BORING_SECTION_MAX_MOTION_SCORE = 45;
export const DEFAULT_ACCELERATED_PLAYBACK_RATE = 1.18;

/**
 * Speeds up flat stretches so calmer clips still contribute context without
 * dragging down the overall pacing.
 */
export function createAccelerateBoringSectionsRule(rate = DEFAULT_ACCELERATED_PLAYBACK_RATE): Rule {
  return {
    id: "accelerate-boring-sections",
    description: "Accelerates low-energy, low-motion clips outside key beats.",
    apply(context) {
      let changed = false;
      const clips = context.timeline.clips.map((clip) => {
        const boring = clip.scores.QualityScore <= DEFAULT_BORING_SECTION_MAX_QUALITY_SCORE && clip.scores.MotionScore <= DEFAULT_BORING_SECTION_MAX_MOTION_SCORE;
        const protectedBeat = clip.storyPhase === "hook" || clip.storyPhase === "climax" || clip.storyPhase === "ending";
        if (!boring || protectedBeat || clip.playbackRate > rate) return clip;
        changed = true;
        return {
          ...clip,
          slowMotion: false,
          playbackRate: rate,
          notes: [...clip.notes, "Playback accelerated to keep a low-energy section concise."],
        };
      });
      if (!changed) return context;
      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips }),
        notes: [...context.notes, "Rule applied: accelerated low-energy sections."],
      };
    },
  };
}

export const accelerateBoringSectionsRule = createAccelerateBoringSectionsRule();
