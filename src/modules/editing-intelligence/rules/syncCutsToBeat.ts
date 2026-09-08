import type { Rule } from "../types";
import { clamp, recalculateTimeline, roundDuration } from "../timeline-helpers";

export const DEFAULT_BEAT_SYNC_MAX_NUDGE_SECONDS = 0.12;
export const DEFAULT_BEAT_SYNC_INTERVAL_FALLBACK_SECONDS = 0.5;
export const DEFAULT_BEAT_SYNC_MIN_CLIP_SECONDS = 1.1;
export const DEFAULT_BEAT_SYNC_MAX_CLIP_SECONDS = 8;

function buildBeatGrid(totalDurationSeconds: number, beatInfo: { beats?: number[]; bpm?: number; intervalSeconds?: number }): number[] {
  if (beatInfo.beats && beatInfo.beats.length > 0) return [...beatInfo.beats].sort((a, b) => a - b);
  const interval = beatInfo.intervalSeconds ?? (beatInfo.bpm ? 60 / beatInfo.bpm : DEFAULT_BEAT_SYNC_INTERVAL_FALLBACK_SECONDS);
  const safeInterval = interval > 0 ? interval : DEFAULT_BEAT_SYNC_INTERVAL_FALLBACK_SECONDS;
  const beats: number[] = [];
  for (let cursor = safeInterval; cursor <= totalDurationSeconds + safeInterval * 2; cursor += safeInterval) {
    beats.push(roundDuration(cursor));
  }
  return beats;
}

function nearestBeat(value: number, beats: readonly number[]): number | null {
  if (beats.length === 0) return null;
  return beats.reduce((best, beat) => (Math.abs(beat - value) < Math.abs((best ?? beat) - value) ? beat : best), beats[0]);
}

/**
 * Nudges cut boundaries toward a supplied beat grid without letting clip
 * durations drift wildly. When no beat info exists, it deliberately no-ops.
 */
export function createSyncCutsToBeatRule(maxNudgeSeconds = DEFAULT_BEAT_SYNC_MAX_NUDGE_SECONDS): Rule {
  return {
    id: "sync-cuts-to-beat",
    description: "Snaps cut points toward the nearest beat when beat info exists.",
    apply(context) {
      if (!context.beatGrid) return context;
      const beats = buildBeatGrid(context.timeline.totalDurationSeconds, context.beatGrid);
      if (beats.length === 0) return context;

      let cursor = 0;
      let changed = false;
      const clips = context.timeline.clips.map((clip, index, allClips) => {
        if (index === allClips.length - 1) {
          cursor += clip.durationSeconds;
          return clip;
        }
        const desiredCut = cursor + clip.durationSeconds;
        const beat = nearestBeat(desiredCut, beats);
        if (beat === null || Math.abs(beat - desiredCut) > (context.beatGrid?.maxNudgeSeconds ?? maxNudgeSeconds)) {
          cursor += clip.durationSeconds;
          return clip;
        }
        const snappedDuration = clamp(beat - cursor, DEFAULT_BEAT_SYNC_MIN_CLIP_SECONDS, DEFAULT_BEAT_SYNC_MAX_CLIP_SECONDS);
        if (Math.abs(snappedDuration - clip.durationSeconds) > 0.001) changed = true;
        cursor += snappedDuration;
        return {
          ...clip,
          durationSeconds: roundDuration(snappedDuration),
        };
      });

      if (!changed) return context;
      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips }),
        notes: [...context.notes, "Rule applied: synced cuts to beat grid."],
      };
    },
  };
}

export const syncCutsToBeatRule = createSyncCutsToBeatRule();
