import type { BestMoment } from "@/types";
import type {
  BaseClipScoreKey,
  ClipScores,
  ComputeClipScoresOptions,
  PartialScoreWeights,
  ScoreSignalKey,
  ScoreSignalWeights,
  ScoreWeights,
} from "./types";
import { clamp, roundScore } from "./timeline-helpers";

export const DEFAULT_ACTION_SCORE_WEIGHTS: ScoreSignalWeights = {
  motion: 0.44,
  subjectFocus: 0.24,
  targetSubject: 0.16,
  retention: 0.1,
  emotion: 0.06,
};
export const DEFAULT_BEAUTY_SCORE_WEIGHTS: ScoreSignalWeights = {
  visualImpact: 0.44,
  clarity: 0.28,
  gpxContext: 0.12,
  landscapeBias: 0.16,
};
export const DEFAULT_EMOTION_SCORE_WEIGHTS: ScoreSignalWeights = {
  emotion: 0.6,
  subjectFocus: 0.18,
  retention: 0.12,
  cinematicBias: 0.1,
};
export const DEFAULT_STABILITY_SCORE_WEIGHTS: ScoreSignalWeights = {
  clarity: 0.56,
  inverseMotion: 0.24,
  inverseMotionJitter: 0.2,
};
export const DEFAULT_MOTION_SCORE_WEIGHTS: ScoreSignalWeights = {
  motion: 0.66,
  retention: 0.2,
  subjectFocus: 0.14,
};
export const DEFAULT_LANDSCAPE_SCORE_WEIGHTS: ScoreSignalWeights = {
  visualImpact: 0.3,
  gpxContext: 0.22,
  clarity: 0.16,
  landscapeBias: 0.22,
  cinematicBias: 0.1,
};
export const DEFAULT_CINEMATIC_SCORE_WEIGHTS: ScoreSignalWeights = {
  visualImpact: 0.24,
  clarity: 0.18,
  emotion: 0.14,
  gpxContext: 0.12,
  subjectFocus: 0.1,
  inverseMotion: 0.1,
  cinematicBias: 0.12,
};

export const DEFAULT_QUALITY_AGGREGATE_WEIGHTS: Record<BaseClipScoreKey, number> = {
  ActionScore: 0.18,
  BeautyScore: 0.14,
  EmotionScore: 0.12,
  StabilityScore: 0.12,
  MotionScore: 0.14,
  LandscapeScore: 0.14,
  CinematicScore: 0.16,
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  action: DEFAULT_ACTION_SCORE_WEIGHTS,
  beauty: DEFAULT_BEAUTY_SCORE_WEIGHTS,
  emotion: DEFAULT_EMOTION_SCORE_WEIGHTS,
  stability: DEFAULT_STABILITY_SCORE_WEIGHTS,
  motion: DEFAULT_MOTION_SCORE_WEIGHTS,
  landscape: DEFAULT_LANDSCAPE_SCORE_WEIGHTS,
  cinematic: DEFAULT_CINEMATIC_SCORE_WEIGHTS,
  qualityAggregate: DEFAULT_QUALITY_AGGREGATE_WEIGHTS,
};

function mergeSignalWeights(base: ScoreSignalWeights, override?: ScoreSignalWeights): ScoreSignalWeights {
  return { ...base, ...(override ?? {}) };
}

export function mergeScoreWeights(overrides?: PartialScoreWeights): ScoreWeights {
  return {
    action: mergeSignalWeights(DEFAULT_SCORE_WEIGHTS.action, overrides?.action),
    beauty: mergeSignalWeights(DEFAULT_SCORE_WEIGHTS.beauty, overrides?.beauty),
    emotion: mergeSignalWeights(DEFAULT_SCORE_WEIGHTS.emotion, overrides?.emotion),
    stability: mergeSignalWeights(DEFAULT_SCORE_WEIGHTS.stability, overrides?.stability),
    motion: mergeSignalWeights(DEFAULT_SCORE_WEIGHTS.motion, overrides?.motion),
    landscape: mergeSignalWeights(DEFAULT_SCORE_WEIGHTS.landscape, overrides?.landscape),
    cinematic: mergeSignalWeights(DEFAULT_SCORE_WEIGHTS.cinematic, overrides?.cinematic),
    qualityAggregate: {
      ...DEFAULT_SCORE_WEIGHTS.qualityAggregate,
      ...(overrides?.qualityAggregate ?? {}),
    },
  };
}

function weightedAverage(signalValues: Record<ScoreSignalKey, number>, weights: ScoreSignalWeights): number {
  let totalWeight = 0;
  let total = 0;
  (Object.entries(weights) as Array<[ScoreSignalKey, number]>).forEach(([key, weight]) => {
    if (!Number.isFinite(weight) || weight <= 0) return;
    totalWeight += weight;
    total += signalValues[key] * weight;
  });
  if (totalWeight <= 0) return 0;
  return clamp(total / totalWeight, 0, 1) * 100;
}

function normalizeBreakdown(moment: BestMoment, options?: ComputeClipScoresOptions): Record<ScoreSignalKey, number> {
  const confidence = clamp(moment.confidence / 100, 0, 1);
  const breakdown = moment.scoreBreakdown;
  const retention = clamp(breakdown?.retention ?? confidence, 0, 1);
  const motion = clamp(breakdown?.motion ?? confidence, 0, 1);
  const visualImpact = clamp(breakdown?.visualImpact ?? confidence, 0, 1);
  const clarity = clamp(breakdown?.clarity ?? confidence, 0, 1);
  const gpxContext = clamp(breakdown?.gpxContext ?? 0.5, 0, 1);
  const emotion = clamp(breakdown?.emotion ?? confidence, 0, 1);
  const subjectFocus = clamp(breakdown?.subjectFocus ?? breakdown?.targetSubject ?? confidence, 0, 1);
  const targetSubject = clamp(breakdown?.targetSubject ?? breakdown?.subjectFocus ?? confidence, 0, 1);
  const motionJitter = clamp(options?.motionJitter ?? motion * (1 - clarity * 0.75), 0, 1);
  const inverseMotion = clamp(1 - motion, 0, 1);
  const inverseMotionJitter = clamp(1 - motionJitter, 0, 1);
  const derivedLandscapeBias = clamp(options?.landscapeBias ?? (visualImpact * 0.45 + clarity * 0.25 + gpxContext * 0.3), 0, 1);
  const derivedCinematicBias = clamp(options?.cinematicBias ?? (visualImpact * 0.28 + clarity * 0.2 + emotion * 0.2 + inverseMotion * 0.14 + gpxContext * 0.18), 0, 1);

  return {
    retention,
    motion,
    visualImpact,
    clarity,
    gpxContext,
    emotion,
    subjectFocus,
    targetSubject,
    inverseMotion,
    inverseMotionJitter,
    landscapeBias: derivedLandscapeBias,
    cinematicBias: derivedCinematicBias,
    ...(options?.signalOverrides ?? {}),
  };
}

/**
 * Re-labels the existing `BestMoment.scoreBreakdown` into editor-friendly
 * clip scores rather than trying to repeat the expensive frame analysis.
 * That keeps this module additive: when upstream analysis improves, these
 * editorial scores inherit the better signals automatically.
 */
export function computeClipScores(moment: BestMoment, options?: ComputeClipScoresOptions): ClipScores {
  const weights = mergeScoreWeights(options?.weights);
  const signals = normalizeBreakdown(moment, options);

  const ActionScore = roundScore(weightedAverage(signals, weights.action));
  const BeautyScore = roundScore(weightedAverage(signals, weights.beauty));
  const EmotionScore = roundScore(weightedAverage(signals, weights.emotion));
  const StabilityScore = roundScore(weightedAverage(signals, weights.stability));
  const MotionScore = roundScore(weightedAverage(signals, weights.motion));
  const LandscapeScore = roundScore(weightedAverage(signals, weights.landscape));
  const CinematicScore = roundScore(weightedAverage(signals, weights.cinematic));

  const aggregateWeightTotal = Object.values(weights.qualityAggregate).reduce((sum, weight) => sum + weight, 0);
  const QualityScore = roundScore(
    aggregateWeightTotal <= 0
      ? 0
      : clamp(
          (ActionScore * weights.qualityAggregate.ActionScore +
            BeautyScore * weights.qualityAggregate.BeautyScore +
            EmotionScore * weights.qualityAggregate.EmotionScore +
            StabilityScore * weights.qualityAggregate.StabilityScore +
            MotionScore * weights.qualityAggregate.MotionScore +
            LandscapeScore * weights.qualityAggregate.LandscapeScore +
            CinematicScore * weights.qualityAggregate.CinematicScore) /
            aggregateWeightTotal,
          0,
          100
        )
  );

  return {
    ActionScore,
    BeautyScore,
    EmotionScore,
    StabilityScore,
    MotionScore,
    LandscapeScore,
    CinematicScore,
    QualityScore,
  };
}
