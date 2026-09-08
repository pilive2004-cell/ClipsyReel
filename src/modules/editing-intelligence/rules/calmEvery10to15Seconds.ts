import type { Rule } from "../types";
import { computeClipCalmness, recalculateTimeline } from "../timeline-helpers";

export const DEFAULT_MIN_CALM_INTERVAL_SECONDS = 10;
export const DEFAULT_MAX_CALM_INTERVAL_SECONDS = 15;
export const DEFAULT_TARGET_CALM_INTERVAL_SECONDS = 12.5;

/**
 * Inserts deliberate breathing beats so rising-energy edits still give the
 * viewer a short reset before the final run-up or closing image.
 */
export function createCalmEvery10to15SecondsRule(targetIntervalSeconds = DEFAULT_TARGET_CALM_INTERVAL_SECONDS): Rule {
  return {
    id: "calm-every-10-to-15-seconds",
    description: "Marks a breathing beat roughly every 10-15 seconds.",
    apply(context) {
      if (context.timeline.clips.length === 0) return context;
      const clips = [...context.timeline.clips];
      const markers = [...context.timeline.markers];
      let changed = false;
      const total = context.timeline.totalDurationSeconds;

      for (let target = targetIntervalSeconds; target < total - 2; target += targetIntervalSeconds) {
        const existing = clips.find((clip) => clip.storyPhase === "breathing_moment" && Math.abs(clip.startSeconds - target) <= 2);
        if (existing) continue;
        const candidateIndex = clips
          .map((clip, index) => ({ clip, index, calmness: computeClipCalmness(clip.scores), distance: Math.abs(clip.startSeconds - target) }))
          .filter(({ clip }) => clip.storyPhase !== "climax" && clip.storyPhase !== "ending")
          .sort((a, b) => b.calmness - a.calmness || a.distance - b.distance || a.clip.momentId.localeCompare(b.clip.momentId))[0]?.index;
        if (candidateIndex === undefined) continue;
        const clip = clips[candidateIndex];
        clips[candidateIndex] = {
          ...clip,
          storyPhase: "breathing_moment",
          emphasis: "breathing",
          transitionAfter: clip.transitionAfter ?? "crossfade",
          notes: [...clip.notes, "Marked as a breathing beat by pacing rule."],
        };
        markers.push({
          type: "breathing_moment",
          timeSeconds: clip.startSeconds,
          label: "Breathing beat",
          momentId: clip.momentId,
        });
        changed = true;
      }

      if (!changed) return context;
      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips, markers }),
        notes: [...context.notes, `Rule applied: inserted calm beats every ${DEFAULT_MIN_CALM_INTERVAL_SECONDS}-${DEFAULT_MAX_CALM_INTERVAL_SECONDS}s.`],
      };
    },
  };
}

export const calmEvery10to15SecondsRule = createCalmEvery10to15SecondsRule();
