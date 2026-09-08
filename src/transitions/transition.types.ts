import { VisualStyleId } from "@/types/style.types";
import { SceneType } from "@/types/timeline.types";
import { CameraMode } from "@/camera/CameraModes";

/** Motion curve applied to a transition — deliberately style-flavored: `sharpSnap`/`elasticSoft` don't belong in the same world as `easeInOut`/`linear`. */
export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut" | "easeOutBack" | "sharpSnap" | "elasticSoft";

/**
 * Internal affinity tags used only by the selector to reason about *why* a
 * transition suits a given style — not part of the required field list, but
 * this is what keeps `TransitionSelector` from becoming a giant switch
 * statement of magic strings. See each style's block in `transitionPresets.ts`.
 */
export type TransitionAffinity =
  | "terrain" // Adventure — physically anchored to mountains/valleys/ridges/clouds
  | "beat" // Viral / Sport — wants to be quantized to a strong music beat
  | "flow" // Travel — continuous, uninterrupted camera/eye direction
  | "action" // Sport — triggered by a real GPX/action event
  | "story" // Cinematic — motivated by narrative/light/atmosphere, never random
  | "subtle"; // Luxury — reads as almost invisible

/** Every transition this system knows about. Grouped by the style family it was designed for, though `compatibleStyles` is the actual source of truth for eligibility. */
export type TransitionId =
  // --- Adventure: terrain used as a physical mask/motivator ---
  | "mountainReveal"
  | "terrainMask"
  | "cloudWipe"
  | "elevationLift"
  | "valleyReveal"
  | "cinematicSpeedRamp"
  | "mapToTerrainDive"
  | "ridgeLineReveal"
  // --- Viral: short, punchy, beat-locked ---
  | "flashCut"
  | "beatCut"
  | "zoomSmash"
  | "whipPan"
  | "motionBlurSwipe"
  | "hyperSpeedRamp"
  | "glitchPulse"
  | "impactZoom"
  | "snapToBeat"
  | "textPopReveal"
  // --- Travel: smooth, continuous, warm ---
  | "crossDissolve"
  | "directionMatch"
  | "horizonMatch"
  | "landscapeReveal"
  | "locationMorph"
  | "softSwipe"
  | "parallaxDrift"
  | "mapZoomToPlace"
  | "daylightBlend"
  // --- Sport: triggered by real action events ---
  | "impactCut"
  | "jumpCut"
  | "velocityBlur"
  | "cornerAttack"
  | "trackingSnap"
  | "accelerationRamp"
  | "brakeHitCut"
  | "dirtSwipe"
  | "shockShakeCut"
  | "povSnap"
  // --- Cinematic: slow, motivated, restrained ---
  | "fadeThroughDarkness"
  | "epicReveal"
  | "cinematicPush"
  | "orbitBlend"
  | "focusShift"
  | "slowSpeedRamp"
  | "atmosphericFade"
  | "shadowWipe"
  | "foregroundMask"
  | "timeOfDayBlend"
  // --- Luxury: almost invisible, light/reflection driven ---
  | "silkFade"
  | "lightSweep"
  | "reflectionMatch"
  | "detailToDetail"
  | "floatingOrbit"
  | "softParallax"
  | "elegantCrossfade"
  | "shadowToLight"
  | "premiumReveal"
  | "slowGradientFade"
  // --- Shared fades: available to Viral / Travel / Cinematic / Luxury for smooth, readable, breathing-room cuts ---
  | "fadeIn"
  | "fadeOut"
  | "crossFade"
  | "softFade"
  | "fadeThroughBlack";

/**
 * Broad "visual family" a transition belongs to — coarser than `TransitionId`
 * but finer than style. Two different `TransitionId`s can still *read* as
 * the same effect on screen (e.g. `whipPan` and `motionBlurSwipe` are both
 * directional wipe/blur effects) — family-level tracking is what lets the
 * selector notice "this would be the 3rd swipe-family cut in a row" even
 * when the exact `TransitionId` keeps changing, which a plain
 * previous-id/history check cannot catch. See `transitionFamilies.ts`.
 */
export type TransitionFamily =
  | "terrain"
  | "beat"
  | "flash"
  | "zoom"
  | "whip"
  | "swipe"
  | "speedRamp"
  | "glitch"
  | "textReveal"
  | "dissolve"
  | "flow"
  | "reveal"
  | "morph"
  | "fade"
  | "impact"
  | "orbit";

export type PerformanceCost = "low" | "medium" | "high";

/** The static, reusable definition of one transition — independent of any specific style choosing it at runtime. */
export interface TransitionDefinition {
  id: TransitionId;
  displayName: string;
  description: string;
  /** [min, max] on-screen seconds this transition can stretch to. */
  durationRange: [number, number];
  /** 0 (invisible) — 10 (maximally aggressive) how intense this transition reads on screen. */
  intensity: number;
  /** Which styles are even allowed to select this transition. This is the hard eligibility gate `TransitionSelector` filters on first. */
  compatibleStyles: VisualStyleId[];
  bestUsedFor: SceneType[];
  cameraBehavior: string;
  visualEffectBehavior: string;
  easing: Easing;
  /** True when this transition needs real terrain data (elevation/slope/ridge line) to look physically motivated — Adventure/Sport/Cinematic terrain beats. */
  requiresTerrainContext: boolean;
  /** True when this transition should be quantized to a detected music beat rather than fired on a fixed schedule. */
  requiresBeatSync: boolean;
  performanceCost: PerformanceCost;
  /** Selector-only affinity tags — see `TransitionAffinity` doc comment. */
  affinities: TransitionAffinity[];
}

/**
 * Everything the selector needs to know about "this exact moment in the
 * edit" to make a style-appropriate, non-random decision.
 *
 * Deliberately a *pure* data bag — `selectTransition(context)` is a pure
 * function of `context` (including `previousTransitionId`, which the caller
 * is responsible for carrying forward), so the same context always produces
 * the same decision and nothing needs to be threaded through hidden state.
 */
export interface TransitionContext {
  selectedStyle: VisualStyleId;
  /** Real-world speed at this moment, in km/h. */
  speedKmh: number;
  /** Route gradient at this moment, in percent (negative = descent). */
  gradientPercent: number;
  /** Elevation change (meters) driving this cut — signed, positive = climbing. */
  elevationChange: number;
  /** 0 (straight line) — 1 (hairpin) how sharp the current turn is. */
  turnSharpness: number;
  /** 0 (flat/dull) — 1 (dramatic peaks/valleys/cliffs) how visually dramatic the terrain is right now. */
  terrainDrama: number;
  /** 0 (no music/no beat) — 1 (strong, unmistakable beat) strength of the detected music beat at this cut point. */
  musicBeatStrength: number;
  /** The previous decision's `transitionId`, so repeats can be avoided — `null` for the first cut of a sequence. */
  previousTransitionId: TransitionId | null;
  /**
   * Optional short rolling history of the last few chosen `transitionId`s
   * (most recent first), used to spread choices across a style's whole
   * preferred palette instead of converging onto just the 1-2 highest-
   * scoring core transitions and oscillating between only those (which read
   * on screen as "it's always the same effect"). Falls back to only
   * `previousTransitionId` when omitted, so existing single-step callers
   * still work unchanged.
   */
  recentTransitionIds?: TransitionId[];
  /** Optional — recent transition families (most recent first), aligned with `recentTransitionIds`, used for family-level overuse/repetition penalties (see `transitionFamilies.ts`). Falls back to deriving families from `recentTransitionIds` via the selector's own definition table when omitted. */
  recentTransitionFamilies?: TransitionFamily[];
  /** True when this moment is primarily about a beautiful view/vista rather than something happening. */
  isScenicMoment: boolean;
  /** True when this moment is primarily about something happening (a jump, a corner, an acceleration). */
  isActionMoment: boolean;
  /** Optional — lets a caller still steer the camera-language text in the decision without being required by the core rule system. Defaults to the style's own first preferred camera mode. */
  cameraMode?: CameraMode;
  /** Optional — lets the selector downgrade away from `performanceCost: "high"` transitions on constrained devices. Omitted = no performance gating. */
  performanceProfile?: PerformanceCost;
  /**
   * True only when a real, explicit text payload will be composited onto
   * this cut. `textPopReveal` is the only transition that visually depends
   * on text — without this flag set, `textPopReveal` is excluded from
   * eligibility entirely so no style can ever "pick" a text-reveal effect
   * for a cut that has no text to reveal.
   */
  hasTextOverlay?: boolean;
}

/** What the selector decided, and — critically — *why*, so the decision is always explainable rather than a black box. */
export interface TransitionDecision {
  transitionId: TransitionId;
  /** Visual family this transition belongs to — surfaced on the decision itself so diagnostics/logging never need to re-look it up. */
  transitionFamily: TransitionFamily;
  duration: number;
  easing: Easing;
  reason: string;
  cameraInfluence: string;
  visualEffectIntensity: number;
}

