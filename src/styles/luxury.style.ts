import { StylePreset } from "@/types/style.types";

/**
 * Luxury — "Smoothness and refinement are the heroes."
 *
 * The lowest-intensity, slowest style in the entire system (intensity 2,
 * shots up to 10s) — deliberately positioned as the polar opposite of
 * Viral. Every transition reads as "almost invisible": light, reflection
 * and soft blur do the work instead of a cut you'd ever consciously notice.
 * Anything with impact, shake or speed is hard-forbidden, which is what
 * keeps Luxury from ever collapsing into "slow Cinematic" — it's calmer
 * and more product-like, not just slower.
 */
export const luxuryPreset: StylePreset = {
  styleId: "luxury",
  displayName: "Luxury",
  emotionalGoal: "Premium quality, elegance, precision, calm and exclusivity.",
  visualSignature: "Smoothness and refinement are the heroes.",
  averageShotDuration: 7.5,
  minShotDuration: 5,
  maxShotDuration: 10,
  transitionIntensity: 2,
  cameraEnergy: 1,
  preferredCameraModes: [
    "floatingCamera",
    "ultraSmoothOrbit",
    "slowDetailReveal",
    "elegantTracking",
    "lowSpeedControlled",
    "softParallaxCam",
    "productFraming",
    "premiumLightMovement",
  ],
  preferredTransitions: [
    "silkFade",
    "lightSweep",
    "reflectionMatch",
    "detailToDetail",
    "floatingOrbit",
    "softParallax",
    "elegantCrossfade",
    "shadowToLight",
    "premiumReveal",
    "slowGradientFade",
    // Shared fades — reinforce Luxury's slow, premium, near-invisible calm.
    "fadeIn",
    "fadeOut",
    "crossFade",
    "softFade",
    "fadeThroughBlack",
  ],
  // No impact cuts, no glitch, no flashy zooms, no hyper ramps, no dirt/shake, no chaotic movement, no whip pans — anything abrupt destroys the premium calm.
  forbiddenTransitions: [
    "impactCut",
    "beatCut",
    "flashCut",
    "brakeHitCut",
    "glitchPulse",
    "zoomSmash",
    "impactZoom",
    "hyperSpeedRamp",
    "accelerationRamp",
    "dirtSwipe",
    "shockShakeCut",
    "cornerAttack",
    "jumpCut",
    "povSnap",
    "trackingSnap",
    "velocityBlur",
    "whipPan",
  ],
  // The 5 explicitly "must prefer" refined signatures for Luxury.
  corePreferredTransitions: ["silkFade", "lightSweep", "elegantCrossfade", "premiumReveal", "slowGradientFade"],
  preferredTransitionCategories: ["subtle"],
  speedRampBehavior: "almostInvisible",
  speedRampLevel: 1,
  motionBlurAmount: 1,
  transitionDurationRange: [2.0, 4.0],
  beatSyncPriority: 0,
  terrainUsagePriority: 0,
  elegancePriority: 10,
  actionPriority: 0,
  smoothnessPriority: 8,
  colorMood: "Premium, muted, desaturated elegance — soft neutrals with a single accent tone.",
  lightingMood: "Soft, diffused, controlled — reflections and rim light over hard shadows.",
  overlayBehavior: "Minimal serif typography, generous negative space, no HUD elements.",
  musicSyncBehavior: "ambient",
  recommendedUseCases: ["Premium car / watch / yacht showcases", "High-end real estate & hospitality", "Brand films for luxury goods", "Any footage meant to feel exclusive and calm"],
};
