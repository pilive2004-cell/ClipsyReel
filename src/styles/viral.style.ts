import { StylePreset } from "@/types/style.types";

/**
 * Viral — "Rhythm is the hero."
 *
 * Still the fastest, most beat-locked style in the system, but rebalanced
 * for readability: shots run 1.5-4.0s (average ~2.5s) and transitions
 * 0.6-1.5s (average ~1.0s) — dynamic and punchy, but the viewer must always
 * have time to actually register each shot before the next one arrives.
 * Beat-synced hard cuts (flashCut/beatCut/zoomSmash/whipPan/hyperSpeedRamp)
 * stay the core signature for the faster moments, while the shared fades
 * (fadeIn/fadeOut/crossFade/softFade/fadeThroughBlack) give scenic/"breathing
 * room" moments a real, visible smooth transition instead of forcing every
 * single cut to be a hard beat-cut.
 */
export const viralPreset: StylePreset = {
  styleId: "viral",
  displayName: "Viral",
  emotionalGoal: "The viewer should not be able to stop watching — fast, punchy, addictive, optimized for retention, but always readable.",
  visualSignature: "Rhythm is the hero.",
  averageShotDuration: 3.4,
  minShotDuration: 2.2,
  maxShotDuration: 5.5,
  transitionIntensity: 10,
  cameraEnergy: 10,
  preferredCameraModes: ["fastPushIn", "aggressiveZoom", "snapChange", "whipPanCam", "fastMapJump", "quickPOV", "beforeAfterReveal"],
  preferredTransitions: [
    "flashCut",
    "beatCut",
    "zoomSmash",
    "whipPan",
    "motionBlurSwipe",
    "hyperSpeedRamp",
    "glitchPulse",
    "impactZoom",
    "snapToBeat",
    "textPopReveal",
    // Breathing-room fades — used for scenic/calmer moments so the edit
    // doesn't feel like it's ALWAYS a hard beat-cut (see `smoothnessPriority`
    // below, and `TransitionSelector`'s "flow"/"subtle" contextual bonus).
    "fadeIn",
    "fadeOut",
    "crossFade",
    "softFade",
  ],
  // Still no cinematic pauses, no luxury subtlety, no lingering establishing
  // shots — but full-black bookends and the shared fades above are now
  // allowed, since occasional breathing room is exactly what was missing.
  forbiddenTransitions: [
    "crossDissolve",
    "silkFade",
    "slowGradientFade",
    "fadeThroughDarkness",
    "epicReveal",
    "cinematicPush",
    "orbitBlend",
    "atmosphericFade",
    "lightSweep",
    "reflectionMatch",
    "detailToDetail",
    "floatingOrbit",
    "softParallax",
    "elegantCrossfade",
    "shadowToLight",
    "premiumReveal",
  ],
  // The 5 explicitly "must prefer" high-energy signatures for Viral.
  corePreferredTransitions: ["flashCut", "beatCut", "zoomSmash", "whipPan", "hyperSpeedRamp"],
  preferredTransitionCategories: ["beat"],
  speedRampBehavior: "hyperPunchy",
  speedRampLevel: 10,
  motionBlurAmount: 8,
  transitionDurationRange: [0.6, 1.5],
  beatSyncPriority: 10,
  terrainUsagePriority: 1,
  elegancePriority: 0,
  actionPriority: 8,
  // Was 1 (near-zero) — bumped just enough that a scenic moment gives the
  // shared fades a real (but still secondary to the beat-synced core)
  // chance to win, instead of a fast beat-cut being mathematically
  // guaranteed to dominate every single cut regardless of context.
  smoothnessPriority: 5,
  colorMood: "High-contrast, saturated, punchy — stop-scroll pop.",
  lightingMood: "Bright, high-key, contrasty — nothing moody or ambiguous.",
  overlayBehavior: "Bold animated captions, emoji accents, beat-synced text pops.",
  musicSyncBehavior: "strictBeat",
  recommendedUseCases: ["Instagram Reels / TikTok", "Highlight teasers", "Quick recap of a big moment", "Social-first short-form content"],
};
