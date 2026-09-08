/**
 * ViralPatternLibrary — shared types.
 *
 * IMPORTANT (legal/ethical scope of this module): everything typed here
 * describes *abstract editing structure* only — timing, energy, rhythm,
 * transition names, emotional phases. Nothing in this module stores,
 * downloads, or reproduces actual video/audio/image content from any
 * source. `sourceType` below is always "user_supplied" or "manual_demo" —
 * there is no code path anywhere in this module that fetches remote
 * TikTok/Instagram content.
 */

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

/** The kind of footage a pattern/recipe is best suited for. */
export type VideoType = "motorcycle" | "road_trip" | "travel" | "offroad" | "drone" | "city" | "mountain";

/** Desired overall editing energy. */
export type EnergyLevel = "calm" | "balanced" | "dynamic" | "extreme";

/** Export aspect ratio. */
export type MontageFormat = "9:16" | "16:9" | "1:1";

/** High-level creative direction, mirrors (but is intentionally decoupled
 * from) the app's existing `ReelStyle` so this module can evolve independently. */
export type MontageStyleTag = "cinematic" | "viral" | "premium" | "adventure" | "emotional";

/** Abstract timeline event kind — describes *editing structure*, never content. */
export type TimelineEventType =
  | "hook"
  | "fast_cut"
  | "wide_context"
  | "surprise_motion"
  | "breathing_shot"
  | "build_up"
  | "climax"
  | "premium_end";

/** Abstract shot-to-shot transition types (editing technique names only). */
export type TransitionType =
  | "direct_cut"
  | "crossfade"
  | "motion_blur"
  | "whip_pan"
  | "zoom_transition"
  | "match_on_action"
  | "object_wipe"
  | "speed_ramp"
  | "flash_cut"
  | "hard_cut_on_beat"
  | "map_transition"
  | "drone_like_reveal"
  | "pov_transition"
  | "loopable_end";

/** How a montage ends. */
export type EndingType = "loop" | "reveal" | "fade" | "hard_cut" | "hero_shot";

/** Emotional-curve phase names (broader vocabulary than the app's existing
 * `EmotionalStoryRole` — this module models a slightly richer curve). */
export type EmotionalPhase =
  | "hook"
  | "orientation"
  | "build_up"
  | "surprise"
  | "climax"
  | "breathing_moment"
  | "premium_ending"
  | "loop_potential";

/** Recipe segment role — the coarse structural blocks a recipe timeline is built from. */
export type SegmentType = "hook" | "context" | "build_up" | "climax" | "premium_end";

/** Abstract shot content descriptor — describes what *kind* of shot fits a slot,
 * never a specific piece of footage. */
export type ShotType =
  | "best_motion_or_landscape"
  | "wide_route_or_map"
  | "alternating_pov_and_landscape"
  | "highest_scoring_moment"
  | "hero_shot_or_arrival"
  | "close_up_detail"
  | "human_or_subject_action"
  | "breathing_wide_shot";

/** Where an analyzed/generated pattern came from. Never a scraped/downloaded video. */
export type PatternSourceType = "user_supplied" | "manual_demo";

// ---------------------------------------------------------------------------
// 1. Abstract editing timeline (structure + rhythm analysis output)
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  time: number;
  type: TimelineEventType;
  energy: number; // 0-100
  shotDuration: number; // seconds
}

export interface VideoStructureAnalysis {
  totalDurationSeconds: number;
  shotCount: number;
  averageShotDuration: number;
  shotDurationVariation: number; // stddev of shot durations
  cutsPerSecond: number;
  slowMoments: Array<{ startSeconds: number; endSeconds: number }>;
  accelerationMoments: Array<{ startSeconds: number; endSeconds: number }>;
  energyTimeline: Array<{ time: number; energy: number }>;
  climaxPositionSeconds: number;
  endingType: EndingType;
}

// ---------------------------------------------------------------------------
// 2. Hook analysis (first ~3 seconds)
// ---------------------------------------------------------------------------

export interface HookAnalysis {
  strongMotion: number; // 0-100
  clearImage: number;
  visualSurprise: number;
  spectacularEnvironment: number;
  visibleSubjectOrAction: number;
  fastShotChange: number;
  hasHookText: boolean;
  visualContrast: number;
  cameraMovement: number;
  unexpectedElement: number;
  hookScore: number; // 0-100 composite
}

// ---------------------------------------------------------------------------
// 3. Cut rhythm analysis
// ---------------------------------------------------------------------------

export interface CutRhythmTimeline {
  events: TimelineEvent[];
  fastCutRatio: number; // 0-1, share of shots under ~0.7s
  slowCutRatio: number; // 0-1, share of shots over ~2.5s
  hasProgressiveBuildUp: boolean;
  hasAccelerationBeforeClimax: boolean;
  wideCloseAlternationScore: number; // 0-100
  breathingShotCount: number;
  jumpCutCount: number;
  matchCutCount: number;
  whipTransitionCount: number;
  beatCutCount: number;
  speedRampCount: number;
  freezeMomentCount: number;
  flashTransitionCount: number;
}

// ---------------------------------------------------------------------------
// 4. Transition patterns
// ---------------------------------------------------------------------------

export interface TransitionPattern {
  transitionType: TransitionType;
  idealBeforeShot: ShotType;
  idealAfterShot: ShotType;
  duration: number; // seconds
  energyImpact: number; // -100..100 (negative = calms down, positive = raises energy)
  recommendedUseCase: string;
}

// ---------------------------------------------------------------------------
// 5. Audio / video sync
// ---------------------------------------------------------------------------

export interface AudioVideoSyncAnalysis {
  estimatedBpm: number;
  mainBeatsSeconds: number[];
  audioIntensityCurve: Array<{ time: number; intensity: number }>;
  musicalDrops: number[]; // seconds
  calmMomentsSeconds: Array<{ startSeconds: number; endSeconds: number }>;
  impactMomentsSeconds: number[];
  cutsSyncedWithBeatRatio: number; // 0-1
  transitionsSyncedWithMusicRatio: number; // 0-1
}

// ---------------------------------------------------------------------------
// 6. Emotional curve
// ---------------------------------------------------------------------------

export interface EmotionalCurveSegment {
  phase: EmotionalPhase;
  start: number;
  end: number;
  energy: number; // 0-100
}

export interface EmotionalCurve {
  curveType: string;
  segments: EmotionalCurveSegment[];
}

// ---------------------------------------------------------------------------
// 7. Pattern library entries ("montage recipes" in abstract, reusable form)
// ---------------------------------------------------------------------------

export type MontagePatternCategory =
  | "Fast Adventure Hook"
  | "Cinematic Road Trip"
  | "Motorcycle POV Rush"
  | "Mountain Reveal"
  | "Before / After Journey"
  | "Calm Premium Travel"
  | "High Energy Action"
  | "Emotional Memory Reel"
  | "Map To Real Footage"
  | "Gear Showcase"
  | "Route Recap"
  | "Weekend Escape";

export interface MontagePattern {
  id: string;
  name: string;
  category: MontagePatternCategory;
  sourceType: PatternSourceType;
  durationRange: [number, number]; // seconds
  idealVideoType: VideoType[];
  energyProfile: EnergyLevel;
  cutRhythm: {
    fastCutRatio: number;
    slowCutRatio: number;
    hasAccelerationBeforeClimax: boolean;
  };
  transitionStyle: TransitionType[];
  hookStyle: {
    minHookScore: number;
    preferredShot: ShotType;
  };
  emotionalCurve: EmotionalCurve;
  recommendedFor: string[];
  avoidWhen: string[];
  uniquenessScore: number; // 0-100
  premiumScore: number; // 0-100
}

// ---------------------------------------------------------------------------
// 8. Montage recipe generation
// ---------------------------------------------------------------------------

export interface MontageRecipeInput {
  desiredDurationSeconds: 15 | 30 | 45 | 60;
  videoType: VideoType;
  desiredEnergy: EnergyLevel;
  format: MontageFormat;
  gpxAvailable: boolean;
  musicAvailable: boolean;
  bestMomentsCount: number;
  style: MontageStyleTag;
}

export interface MontageRecipeSegment {
  start: number;
  end: number;
  segmentType: SegmentType;
  shotType: ShotType;
  transitionOut: TransitionType;
  energy: number; // 0-100
}

export interface MontageRecipe {
  recipeName: string;
  duration: number;
  openingStrategy: string;
  timeline: MontageRecipeSegment[];
  /** Which library pattern(s) this recipe was derived from — for traceability. */
  basePatternIds: string[];
  /** A short human-readable signature capturing the variation choices made
   * (transitions + shot slots), used by PatternMixer to avoid repeats. */
  editingSignature: string;
}

// ---------------------------------------------------------------------------
// 9. Pattern mixer
// ---------------------------------------------------------------------------

export interface PatternMixOptions {
  /** Signatures of recently generated recipes (most recent first) to avoid repeating. */
  recentSignatures?: string[];
  /** Optional seed for deterministic variation in tests. */
  seed?: number;
}

export interface PatternMixResult {
  recipe: MontageRecipe;
  coherenceScore: number; // 0-100
  variationNotes: string[];
}

// ---------------------------------------------------------------------------
// 10. Montage quality score
// ---------------------------------------------------------------------------

export interface MontageQualityBreakdown {
  hookScore: number;
  rhythmScore: number;
  varietyScore: number;
  emotionalCurveScore: number;
  transitionCoherenceScore: number;
  musicSyncScore: number;
  premiumFeelScore: number;
  loopPotentialScore: number;
}

export interface MontageQualityResult {
  overallScore: number; // 0-100
  breakdown: MontageQualityBreakdown;
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Reference-video analysis (legally-owned videos supplied by the user only)
// ---------------------------------------------------------------------------

/** Full abstract analysis extracted from one user-supplied reference video.
 * Never includes raw frames, audio samples, or any copy of the source file. */
export interface ViralPatternAnalysisResult {
  sourceFileName: string;
  structure: VideoStructureAnalysis;
  hook: HookAnalysis;
  rhythm: CutRhythmTimeline;
  transitions: TransitionPattern[];
  audioSync: AudioVideoSyncAnalysis;
  emotionalCurve: EmotionalCurve;
  /** A derived, storable MontagePattern distilled from the above — this is
   * the only thing ever persisted in the PatternLibrary. */
  derivedPattern: MontagePattern;
}
