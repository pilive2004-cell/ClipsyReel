import { StylePreset } from "@/types/style.types";

/**
 * Travel — "The journey is the hero."
 *
 * The defining trait is continuity: camera direction, horizon line and
 * color temperature are all deliberately matched across cuts so the eye
 * never feels interrupted (`directionMatch`, `horizonMatch`,
 * `daylightBlend`). This is what separates Travel's "flow" from
 * Adventure's more physical, terrain-anchored cuts and from Luxury's
 * near-static refinement — Travel is always gently *moving forward*.
 */
export const travelPreset: StylePreset = {
  styleId: "travel",
  displayName: "Travel",
  emotionalGoal: "Discovery, beauty, flow and emotional travel memories.",
  visualSignature: "The journey is the hero.",
  averageShotDuration: 3,
  minShotDuration: 2,
  maxShotDuration: 4.5,
  transitionIntensity: 5,
  cameraEnergy: 4,
  preferredCameraModes: ["smoothDronePan", "softTracking", "horizonLevel", "gentlePullback", "mapToLandscape", "relaxedOrbit"],
  preferredTransitions: [
    "crossDissolve",
    "directionMatch",
    "horizonMatch",
    "landscapeReveal",
    "locationMorph",
    "softSwipe",
    "parallaxDrift",
    "mapZoomToPlace",
    "daylightBlend",
    // Shared fades — reinforce Travel's smooth, premium flow and give even
    // more variety inside its already-fade-first palette.
    "fadeIn",
    "fadeOut",
    "crossFade",
    "softFade",
    "fadeThroughBlack",
  ],
  // No aggressive flashes, no hard impacts, no extreme ramps, no luxury product-detail cuts — anything jarring breaks the "flow" signature.
  forbiddenTransitions: ["flashCut", "glitchPulse", "impactCut", "impactZoom", "beatCut", "hyperSpeedRamp", "accelerationRamp", "detailToDetail", "premiumReveal"],
  // The 5 explicitly "must prefer" flow signatures for Travel.
  corePreferredTransitions: ["crossDissolve", "directionMatch", "horizonMatch", "landscapeReveal", "locationMorph"],
  preferredTransitionCategories: ["flow"],
  speedRampBehavior: "flowing",
  speedRampLevel: 4,
  motionBlurAmount: 3,
  transitionDurationRange: [1.0, 2.0],
  beatSyncPriority: 2,
  terrainUsagePriority: 3,
  elegancePriority: 6,
  actionPriority: 2,
  smoothnessPriority: 10,
  colorMood: "Warm, dreamy, wanderlust — golden light, gentle saturation lift.",
  lightingMood: "Soft natural daylight, gentle haze, romanticized golden hour.",
  overlayBehavior: "Location pins and gentle map callouts, handwritten-style captions.",
  musicSyncBehavior: "phraseLevel",
  recommendedUseCases: ["Vacation & city-hopping recaps", "Road trips and scenic drives", "Cultural/food discovery journeys", "Multi-location travel montages"],
};
