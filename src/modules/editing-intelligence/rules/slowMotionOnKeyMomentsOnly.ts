import type { Rule } from "../types";
import { computeClipEnergy, recalculateTimeline } from "../timeline-helpers";

export const DEFAULT_SLOW_MOTION_MIN_QUALITY_SCORE = 88;
export const DEFAULT_SLOW_MOTION_MIN_ACTION_SCORE = 82;
export const DEFAULT_SLOW_MOTION_RATE = 0.72;

function qualifiesForSlowMotion(clip: { storyPhase: string; scores: { QualityScore: number; ActionScore: number } }): boolean {
  return (clip.storyPhase === "climax" || clip.storyPhase === "action") && clip.scores.QualityScore >= DEFAULT_SLOW_MOTION_MIN_QUALITY_SCORE && clip.scores.ActionScore >= DEFAULT_SLOW_MOTION_MIN_ACTION_SCORE;
}

/**
 * Keeps slow motion rare and deliberate so it still reads as a payoff beat,
 * not a blanket effect pasted over every energetic clip.
 */
export function createSlowMotionOnKeyMomentsOnlyRule(rate = DEFAULT_SLOW_MOTION_RATE): Rule {
  return {
    id: "slow-motion-on-key-moments-only",
    description: "Restricts slow motion to genuine action/climax highlights.",
    apply(context) {
      let changed = false;
      let clips = context.timeline.clips.map((clip) => {
        if ((clip.slowMotion || clip.playbackRate < 1) && !qualifiesForSlowMotion(clip)) {
          changed = true;
          return {
            ...clip,
            slowMotion: false,
            playbackRate: 1,
            notes: [...clip.notes, "Slow motion removed because the moment was not strong enough."],
          };
        }
        return clip;
      });

      if (!clips.some((clip) => clip.slowMotion)) {
        const candidateIndex = clips
          .map((clip, index) => ({ clip, index, energy: computeClipEnergy(clip.scores) }))
          .filter(({ clip }) => qualifiesForSlowMotion(clip))
          .sort((a, b) => b.energy - a.energy || a.clip.momentId.localeCompare(b.clip.momentId))[0]?.index;
        if (candidateIndex !== undefined) {
          changed = true;
          clips = clips.map((clip, index) =>
            index === candidateIndex
              ? {
                  ...clip,
                  slowMotion: true,
                  playbackRate: rate,
                  notes: [...clip.notes, "Slow motion reserved for a key moment."],
                }
              : clip
          );
        }
      }

      if (!changed) return context;
      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips }),
        notes: [...context.notes, "Rule applied: gated slow motion to key moments."],
      };
    },
  };
}

export const slowMotionOnKeyMomentsOnlyRule = createSlowMotionOnKeyMomentsOnlyRule();
