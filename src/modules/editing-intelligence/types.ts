/**
 * Editing Intelligence — shared domain types.
 *
 * This module intentionally stays decoupled from the production ffmpeg.wasm
 * render path for now: its job is to model richer editorial intent in a way
 * that can be reasoned about, tested, and eventually bridged in safely.
 */

export type ActionScore = number;
export type BeautyScore = number;
export type EmotionScore = number;
export type StabilityScore = number;
export type MotionScore = number;
export type LandscapeScore = number;
export type CinematicScore = number;
export type QualityScore = number;

export interface ClipScores {
  ActionScore: ActionScore;
  BeautyScore: BeautyScore;
  EmotionScore: EmotionScore;
  StabilityScore: StabilityScore;
  MotionScore: MotionScore;
  LandscapeScore: LandscapeScore;
  CinematicScore: CinematicScore;
  QualityScore: QualityScore;
}

export type BaseClipScoreKey = Exclude<keyof ClipScores, "QualityScore">;

/**
 * Signal vocabulary used by `ScoreEngine`.
 *
 * Re-using a shared signal map keeps score recipes data-driven: new editorial
 * scores can be introduced later by adding a weight map instead of cloning the
 * underlying video-analysis heuristics.
 */
export type ScoreSignalKey =
  | "retention"
  | "motion"
  | "visualImpact"
  | "clarity"
  | "gpxContext"
  | "emotion"
  | "subjectFocus"
  | "targetSubject"
  | "inverseMotion"
  | "inverseMotionJitter"
  | "landscapeBias"
  | "cinematicBias";

export type ScoreSignalWeights = Partial<Record<ScoreSignalKey, number>>;

export interface ScoreWeights {
  action: ScoreSignalWeights;
  beauty: ScoreSignalWeights;
  emotion: ScoreSignalWeights;
  stability: ScoreSignalWeights;
  motion: ScoreSignalWeights;
  landscape: ScoreSignalWeights;
  cinematic: ScoreSignalWeights;
  qualityAggregate: Record<BaseClipScoreKey, number>;
}

export type PartialScoreWeights = {
  [K in keyof ScoreWeights]?: K extends "qualityAggregate"
    ? Partial<Record<BaseClipScoreKey, number>>
    : ScoreSignalWeights;
};

export interface ComputeClipScoresOptions {
  weights?: PartialScoreWeights;
  /** Higher values reduce stability when upstream analysis exposes especially jittery motion. */
  motionJitter?: number;
  /** Allows callers to bias toward scenic/context-heavy moments without re-running image analysis. */
  landscapeBias?: number;
  /** Lets callers promote footage that already carries a deliberate premium/dramatic feel. */
  cinematicBias?: number;
  /** Last-resort escape hatch for tests or future sensors that want to override a single signal cleanly. */
  signalOverrides?: Partial<Record<ScoreSignalKey, number>>;
}

export type StoryPhase =
  | "hook"
  | "introduction"
  | "build_up"
  | "action"
  | "climax"
  | "breathing_moment"
  | "ending";

export type CameraAngle = "pov" | "wide" | "close_up" | "drone" | "side" | "rear" | "unknown";
export type CameraSourceType = "gopro" | "drone" | "phone" | "mirrorless" | "helmet_cam" | "unknown";
export type TimelineOverlayType = "map" | "speed" | "altitude" | "location" | "text";
export type TimelineEmphasis = "normal" | "highlight" | "climax" | "breathing";

export interface EditingClipCandidate {
  momentId: string;
  scores: ClipScores;
  sourceIndex?: number;
  sourceStartSeconds?: number;
  durationSeconds?: number;
  sequenceIndex?: number;
  cameraAngle?: CameraAngle | null;
  sourceType?: CameraSourceType | null;
  tags?: string[];
}

export interface StoryAssignment {
  momentId: string;
  phase: StoryPhase;
  orderIndex: number;
  scores: ClipScores;
  rationale: string;
  sourceIndex: number | null;
  sequenceIndex: number;
}

export type GpxInterestingMomentKind = "speed_peak" | "slope_peak" | "elevation_push" | "viewpoint" | "technical_section" | "stop";

export interface GpxSignalSample {
  pointIndex: number;
  elapsedSeconds: number;
  timestamp: Date | null;
  distanceFromStartMeters: number;
  speedMps: number;
  headingDeg: number;
  altitudeM: number | null;
  slopePercent: number;
  accelerationMps2: number;
  headingVarianceDeg: number;
}

export interface GpxViewpoint {
  pointIndex: number;
  elapsedSeconds: number;
  timestamp: Date | null;
  altitudeM: number;
  prominenceM: number;
  scenicScore: number;
}

export interface GpxStopSection {
  startPointIndex: number;
  endPointIndex: number;
  startElapsedSeconds: number;
  endElapsedSeconds: number;
  durationSeconds: number;
  averageSpeedMps: number;
}

export interface GpxDifficultSection {
  startPointIndex: number;
  endPointIndex: number;
  startElapsedSeconds: number;
  endElapsedSeconds: number;
  averageSlopePercent: number;
  averageHeadingVarianceDeg: number;
  severity: number;
}

export interface GpxInterestingMoment {
  kind: GpxInterestingMomentKind;
  pointIndex: number;
  elapsedSeconds: number;
  timestamp: Date | null;
  intensity: number;
  label: string;
}

export interface GpxSignalsResult {
  samples: GpxSignalSample[];
  viewpoints: GpxViewpoint[];
  stops: GpxStopSection[];
  difficultSections: GpxDifficultSection[];
  interestingMoments: GpxInterestingMoment[];
  summary: {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    maxSpeedMps: number;
    maxSlopePercent: number;
    highestAltitudeM: number | null;
  };
}

export type DSLInstructionType =
  | "HOOK"
  | "BEST_SHOT"
  | "SYNC_BEAT"
  | "CUT"
  | "SHOW_MAP"
  | "SHOW_SPEED"
  | "SHOW_ALTITUDE"
  | "SHOW_LOCATION"
  | "SHOW_TEXT"
  | "SLOW_MOTION"
  | "DRONE_REVEAL"
  | "ENDING";

export type DSLComparisonOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface DSLIdentifierValue {
  kind: "identifier";
  value: string;
}

export interface DSLNumberValue {
  kind: "number";
  value: number;
}

export interface DSLComparisonExpression {
  kind: "comparison";
  left: DSLIdentifierValue;
  operator: DSLComparisonOperator;
  right: DSLNumberValue | DSLIdentifierValue;
}

export interface DSLConditionalExpression {
  kind: "conditional";
  condition: DSLComparisonExpression;
}

export type DSLExpression = DSLIdentifierValue | DSLNumberValue | DSLComparisonExpression | DSLConditionalExpression;

export interface DSLNamedArgument {
  kind: "named";
  name: string;
  value: DSLExpression;
}

export interface DSLPositionalArgument {
  kind: "positional";
  value: DSLExpression;
}

export type DSLArgument = DSLNamedArgument | DSLPositionalArgument;

interface DSLInstructionBase<T extends DSLInstructionType> {
  type: T;
  line: number;
  raw: string;
  args: DSLArgument[];
}

export type HookInstruction = DSLInstructionBase<"HOOK">;
export type BestShotInstruction = DSLInstructionBase<"BEST_SHOT">;
export type SyncBeatInstruction = DSLInstructionBase<"SYNC_BEAT">;
export type CutInstruction = DSLInstructionBase<"CUT">;
export type ShowMapInstruction = DSLInstructionBase<"SHOW_MAP">;
export type ShowSpeedInstruction = DSLInstructionBase<"SHOW_SPEED">;
export type ShowAltitudeInstruction = DSLInstructionBase<"SHOW_ALTITUDE">;
export type ShowLocationInstruction = DSLInstructionBase<"SHOW_LOCATION">;
export type ShowTextInstruction = DSLInstructionBase<"SHOW_TEXT">;
export type SlowMotionInstruction = DSLInstructionBase<"SLOW_MOTION">;
export type DroneRevealInstruction = DSLInstructionBase<"DRONE_REVEAL">;
export type EndingInstruction = DSLInstructionBase<"ENDING">;

export type DSLInstruction =
  | HookInstruction
  | BestShotInstruction
  | SyncBeatInstruction
  | CutInstruction
  | ShowMapInstruction
  | ShowSpeedInstruction
  | ShowAltitudeInstruction
  | ShowLocationInstruction
  | ShowTextInstruction
  | SlowMotionInstruction
  | DroneRevealInstruction
  | EndingInstruction;

export interface ResolvedEditingInstruction {
  id: string;
  type: DSLInstructionType;
  line: number;
  momentId: string | null;
  clipIndex: number | null;
  args: DSLArgument[];
  notes: string[];
}

export interface EditingTimelineClip {
  momentId: string;
  sourceIndex: number | null;
  sourceStartSeconds: number | null;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  playbackRate: number;
  slowMotion: boolean;
  storyPhase: StoryPhase;
  scores: ClipScores;
  cameraAngle: CameraAngle | null;
  sourceType: CameraSourceType | null;
  transitionAfter: string | null;
  overlays: TimelineOverlayType[];
  emphasis: TimelineEmphasis;
  notes: string[];
}

export interface TimelineMarker {
  type: "beat_sync" | "breathing_moment" | "gpx_highlight" | "instruction";
  timeSeconds: number;
  label: string;
  momentId?: string;
}

export interface EditingTimeline {
  clips: EditingTimelineClip[];
  instructions: ResolvedEditingInstruction[];
  markers: TimelineMarker[];
  totalDurationSeconds: number;
}

export interface BeatGrid {
  bpm?: number;
  beats?: number[];
  intervalSeconds?: number;
  maxNudgeSeconds?: number;
}

export interface EditingInterpreterContext {
  defaultClipDuration?: number;
  storyAssignments?: StoryAssignment[];
  beatGrid?: BeatGrid;
  gpxMoments?: GpxInterestingMoment[];
  profile?: EditingProfile;
  transitionPool?: string[];
}

export interface RuleContext {
  timeline: EditingTimeline;
  clipCatalog: Record<string, EditingClipCandidate>;
  beatGrid?: BeatGrid;
  gpxSignals?: GpxSignalsResult;
  gpxMoments?: GpxInterestingMoment[];
  profileId?: string;
  notes: string[];
}

export interface Rule {
  id: string;
  description: string;
  apply: (context: RuleContext) => RuleContext;
}

export interface EditingPatternMemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type EditingProfileId =
  | "viral"
  | "adventure"
  | "cinematic"
  | "travel"
  | "sport"
  | "luxury";

export interface EditingProfile {
  id: EditingProfileId;
  label: string;
  pacing: {
    averageClipSeconds: number;
    minClipSeconds: number;
    maxClipSeconds: number;
    curve: "steady" | "rising" | "pulse" | "slow_burn";
    calmIntervalSeconds: [number, number];
  };
  transitions: {
    preferred: string[];
    avoidRepeats: boolean;
    mode: "hard_cut" | "mixed" | "cinematic" | "kinetic";
    beatAligned: boolean;
  };
  cameraSelection: {
    preferredAngles: CameraAngle[];
    preferredSources: CameraSourceType[];
    alternateAngles: boolean;
    prioritizeLandscape: boolean;
    prioritizeAction: boolean;
  };
  clipDuration: {
    hookSeconds: number;
    standardSeconds: number;
    buildUpSeconds: number;
    climaxSeconds: number;
    breathingSeconds: number;
    endingSeconds: number;
    slowMotionRate: number;
    accelerationRate: number;
  };
  overlays: {
    map: boolean;
    speed: boolean;
    altitude: boolean;
    location: boolean;
    text: boolean;
  };
  colorGrading: {
    profile: string;
    saturation: number;
    contrast: number;
    temperature: number;
    shadows: number;
    highlights: number;
  };
  musicSync: {
    mode: "beats" | "interval" | "loose" | "off";
    preferredBpmRange: [number, number];
    cutNudgeSeconds: number;
    emphasizeDrops: boolean;
  };
  storytellingStyle: {
    arc: "adventure" | "cinematic" | "viral" | "documentary" | "brand";
    openingStrategy: "best_shot" | "calm_reveal" | "map_first" | "action_first";
    climaxStrategy: "late_peak" | "mid_peak" | "rolling";
    endingStrategy: "hero_landscape" | "emotional_resolve" | "loopable";
    breathingMomentRequired: boolean;
    prioritizeEmotion: boolean;
    prioritizeLandscape: boolean;
  };
}
