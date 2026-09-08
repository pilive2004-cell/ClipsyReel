import { StylePreset } from "@/types/style.types";

/**
 * Cinematic — "Emotion and composition are the heroes."
 *
 * The slowest, most restrained style outside of Luxury — every transition
 * must be *motivated* by story, light or atmosphere (never random), and the
 * shot durations (4-8s) are roughly 4-8x longer than Viral's. This
 * restraint, plus a total ban on anything glitchy/whip-panned/beat-cut, is
 * what gives Cinematic its documentary/film-sequence feel rather than a
 * slowed-down version of Adventure.
 */
export const cinematicPreset: StylePreset = {
  styleId: "cinematic",
  displayName: "Cinematic",
  emotionalGoal: "Emotion, scale, story and atmosphere — a documentary or movie sequence.",
  visualSignature: "Emotion and composition are the heroes.",
  averageShotDuration: 6,
  minShotDuration: 4,
  maxShotDuration: 8,
  transitionIntensity: 4,
  cameraEnergy: 3,
  preferredCameraModes: [
    "stableCrane",
    "slowPushIn",
    "wideEstablishingCinematic",
    "orbitBlendCam",
    "controlledFlyover",
    "longLensFeel",
    "slowReveal",
    "smoothPullback",
    "framedSubject",
  ],
  preferredTransitions: [
    "fadeThroughDarkness",
    "epicReveal",
    "cinematicPush",
    "orbitBlend",
    "focusShift",
    "slowSpeedRamp",
    "atmosphericFade",
    "shadowWipe",
    "foregroundMask",
    "timeOfDayBlend",
    // Shared fades — reinforce Cinematic's atmospheric, story-driven flow.
    "fadeIn",
    "fadeOut",
    "crossFade",
    "softFade",
    "fadeThroughBlack",
  ],
  // No viral edits, no excessive zooms, no glitch, no aggressive whip pans — anything sudden breaks the "let it breathe" contract.
  forbiddenTransitions: [
    "flashCut",
    "beatCut",
    "zoomSmash",
    "whipPan",
    "snapToBeat",
    "hyperSpeedRamp",
    "impactZoom",
    "glitchPulse",
    "cornerAttack",
    "dirtSwipe",
    "shockShakeCut",
    "motionBlurSwipe",
  ],
  // The 5 explicitly "must prefer" atmospheric/story signatures for Cinematic.
  corePreferredTransitions: ["epicReveal", "cinematicPush", "orbitBlend", "atmosphericFade", "fadeThroughDarkness"],
  preferredTransitionCategories: ["story"],
  speedRampBehavior: "slowDeliberate",
  speedRampLevel: 3,
  motionBlurAmount: 2,
  transitionDurationRange: [1.5, 3.0],
  beatSyncPriority: 1,
  terrainUsagePriority: 4,
  elegancePriority: 7,
  actionPriority: 2,
  smoothnessPriority: 6,
  colorMood: "Film-grade, desaturated, moody contrast — teal-and-orange restraint, not a filter slapped on top.",
  lightingMood: "Motivated, atmospheric, low-key when the story calls for it.",
  overlayBehavior: "Minimal — a single title card at most, no persistent HUD.",
  musicSyncBehavior: "phraseLevel",
  recommendedUseCases: ["Documentary-style trip recaps", "Brand/story films", "Emotional highlight reels", "Any footage where the story matters more than the pace"],
};
