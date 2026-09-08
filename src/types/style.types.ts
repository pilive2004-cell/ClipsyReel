import { CameraMode } from "@/camera/CameraModes";
import { TransitionAffinity, TransitionId } from "@/transitions/transition.types";

/** The 6 required visual styles. This is the single source of truth other modules (transitions, camera, render) key off of. */
export type VisualStyleId = "adventure" | "viral" | "travel" | "sport" | "cinematic" | "luxury";

/**
 * How speed ramping *feels* for a given style — not a single multiplier, but
 * a behavioral signature. Two styles can both use "slow-mo" but read
 * completely differently: Adventure eases in/out around one dramatic beat,
 * Viral never stops micro-ramping, Luxury barely ramps at all.
 */
export type SpeedRampBehavior =
  /** No speed ramping — cuts stay at real, constant speed (used defensively, not by any of the 6 styles below). */
  | "none"
  /** Adventure: ease into a burst of speed around a scenic/dramatic beat, then ease back out — "slow-fast-slow". */
  | "slowFastSlow"
  /** Viral: near-constant, punchy micro speed changes locked to the beat — the ramp itself IS the rhythm. */
  | "hyperPunchy"
  /** Travel: gentle, continuous ramps that are almost imperceptible — flow over spectacle. */
  | "flowing"
  /** Sport: ramps triggered by real action events (acceleration, braking, jumps) rather than a fixed schedule. */
  | "impactDriven"
  /** Cinematic: rare, long, deliberate ramps reserved for a single key story beat — restraint is the point. */
  | "slowDeliberate"
  /** Luxury: extremely subtle ramps that should never be consciously noticed. */
  | "almostInvisible";

/** How cuts/transitions relate to the music track. */
export type MusicSyncBehavior =
  /** Cuts land close to the beat but aren't force-quantized. */
  | "loose"
  /** Every cut is quantized to the nearest strong beat — the edit IS the music (Viral, Sport). */
  | "strictBeat"
  /** Syncs to musical phrases/sections rather than individual beats (Travel, Cinematic). */
  | "phraseLevel"
  /** Barely synced at all — mood-driven, not beat-driven (Luxury). */
  | "ambient"
  /** Driven primarily by GPX/action events, music sync is secondary (Adventure, Sport). */
  | "eventDriven";

/**
 * The full editorial contract for one visual style. Every field here exists
 * so that two styles can never accidentally collapse into "the same edit
 * with different colors" — rhythm, camera vocabulary, transition palette,
 * speed-ramp behavior, color/light direction and music sync are ALL forced
 * to diverge per style.
 */
export interface StylePreset {
  styleId: VisualStyleId;
  displayName: string;
  /** What the viewer should *feel* — this is the north star every other field serves. */
  emotionalGoal: string;
  /** The one-sentence "what is the hero of the frame" statement that anchors every editing decision for this style. */
  visualSignature: string;
  averageShotDuration: number;
  minShotDuration: number;
  maxShotDuration: number;
  /** 0 (invisible) — 10 (maximally aggressive) intensity ceiling for this style's transitions. */
  transitionIntensity: number;
  /** 0 (static/floating) — 10 (constantly moving/snapping) how much the camera itself moves. */
  cameraEnergy: number;
  preferredCameraModes: CameraMode[];
  preferredTransitions: TransitionId[];
  /**
   * The 5 "signature" transitions explicitly called out for this style —
   * a strict subset of `preferredTransitions`. `TransitionSelector` gives
   * these an extra strong scoring bonus so a typical/strong context for
   * this style reliably lands on one of them, while the broader
   * `preferredTransitions` pool still adds variety in calmer contexts.
   */
  corePreferredTransitions: TransitionId[];
  /** Transitions that must NEVER be selected for this style, even as a fallback — these are what makes styles feel distinct, not just "less of the same". */
  forbiddenTransitions: TransitionId[];
  /** Which `TransitionAffinity` tag(s) this style's rule engine should weight most heavily (terrain for Adventure, beat for Viral, flow for Travel, action for Sport, story for Cinematic, subtle for Luxury). */
  preferredTransitionCategories: TransitionAffinity[];
  speedRampBehavior: SpeedRampBehavior;
  /** 0 (no ramping at all) — 10 (constant, aggressive ramping) numeric companion to `speedRampBehavior`, used directly by the rule engine's scoring math. */
  speedRampLevel: number;
  /** 0 (crisp) — 10 (heavy blur) amount of motion blur applied on fast movement/transitions. */
  motionBlurAmount: number;
  /** [min, max] on-screen seconds a transition is allowed to last for this style — the hard "duration rule" ceiling/floor, independent of any single transition's own `durationRange`. */
  transitionDurationRange: [number, number];
  /** 0 (never react to the beat) — 10 (every cut must land on the beat). */
  beatSyncPriority: number;
  /** 0 (ignore terrain entirely) — 10 (terrain is the primary driver of every cut). */
  terrainUsagePriority: number;
  /** 0 (no restraint) — 10 (maximum restraint/refinement — Luxury's defining trait). */
  elegancePriority: number;
  /** 0 (never react to action events) — 10 (every cut is an action event — Sport's defining trait). */
  actionPriority: number;
  /** 0 (jarring, disconnected cuts) — 10 (perfectly continuous, flowing cuts — Travel's defining trait). */
  smoothnessPriority: number;
  colorMood: string;
  lightingMood: string;
  overlayBehavior: string;
  musicSyncBehavior: MusicSyncBehavior;
  recommendedUseCases: string[];
}
