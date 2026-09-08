import type {
  ClipScores,
  EditingClipCandidate,
  EditingTimeline,
  EditingTimelineClip,
  StoryPhase,
  TimelineEmphasis,
  TimelineOverlayType,
} from "./types";

export const DEFAULT_MIN_TIMELINE_CLIP_DURATION_SECONDS = 1.2;
export const SCORE_DECIMAL_PRECISION = 1;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundScore(value: number): number {
  const scale = 10 ** SCORE_DECIMAL_PRECISION;
  return Math.round(value * scale) / scale;
}

export function roundDuration(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function computeClipEnergy(scores: ClipScores): number {
  return roundScore(
    scores.ActionScore * 0.3 +
      scores.MotionScore * 0.24 +
      scores.QualityScore * 0.22 +
      scores.EmotionScore * 0.14 +
      scores.CinematicScore * 0.1
  );
}

export function computeClipCalmness(scores: ClipScores): number {
  return roundScore(
    scores.StabilityScore * 0.34 +
      scores.BeautyScore * 0.24 +
      scores.LandscapeScore * 0.22 +
      scores.CinematicScore * 0.12 +
      (100 - scores.MotionScore) * 0.08
  );
}

export function stableCandidateSort(candidates: readonly EditingClipCandidate[]): EditingClipCandidate[] {
  return [...candidates].sort((a, b) => {
    const aSequence = a.sequenceIndex ?? Number.MAX_SAFE_INTEGER;
    const bSequence = b.sequenceIndex ?? Number.MAX_SAFE_INTEGER;
    if (aSequence !== bSequence) return aSequence - bSequence;
    const aStart = a.sourceStartSeconds ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.sourceStartSeconds ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    return a.momentId.localeCompare(b.momentId);
  });
}

export function recalculateTimeline(timeline: EditingTimeline): EditingTimeline {
  let cursor = 0;
  const clips = timeline.clips.map((clip) => {
    const durationSeconds = roundDuration(Math.max(DEFAULT_MIN_TIMELINE_CLIP_DURATION_SECONDS, clip.durationSeconds));
    const startSeconds = roundDuration(cursor);
    const endSeconds = roundDuration(startSeconds + durationSeconds);
    cursor = endSeconds;
    return {
      ...clip,
      durationSeconds,
      startSeconds,
      endSeconds,
    } satisfies EditingTimelineClip;
  });

  return {
    ...timeline,
    clips,
    totalDurationSeconds: roundDuration(cursor),
  };
}

export function dedupeOverlays(overlays: readonly TimelineOverlayType[]): TimelineOverlayType[] {
  return overlays.filter((overlay, index) => overlays.indexOf(overlay) === index);
}

export function buildTimelineClip(input: {
  candidate: EditingClipCandidate;
  phase: StoryPhase;
  durationSeconds: number;
  emphasis?: TimelineEmphasis;
  transitionAfter?: string | null;
  overlays?: TimelineOverlayType[];
  slowMotion?: boolean;
  playbackRate?: number;
  notes?: string[];
}): EditingTimelineClip {
  return {
    momentId: input.candidate.momentId,
    sourceIndex: input.candidate.sourceIndex ?? null,
    sourceStartSeconds: input.candidate.sourceStartSeconds ?? null,
    durationSeconds: roundDuration(Math.max(DEFAULT_MIN_TIMELINE_CLIP_DURATION_SECONDS, input.durationSeconds)),
    startSeconds: 0,
    endSeconds: 0,
    playbackRate: input.playbackRate ?? 1,
    slowMotion: input.slowMotion ?? false,
    storyPhase: input.phase,
    scores: input.candidate.scores,
    cameraAngle: input.candidate.cameraAngle ?? null,
    sourceType: input.candidate.sourceType ?? null,
    transitionAfter: input.transitionAfter ?? null,
    overlays: dedupeOverlays(input.overlays ?? []),
    emphasis: input.emphasis ?? "normal",
    notes: [...(input.notes ?? [])],
  };
}

export function appendOverlay(clip: EditingTimelineClip, overlay: TimelineOverlayType): EditingTimelineClip {
  return {
    ...clip,
    overlays: dedupeOverlays([...clip.overlays, overlay]),
  };
}

export function timelineSignature(timeline: EditingTimeline): string {
  return timeline.clips
    .map((clip) => `${clip.storyPhase}:${clip.momentId}:${clip.transitionAfter ?? "cut"}:${clip.overlays.join("+")}`)
    .join("|");
}
