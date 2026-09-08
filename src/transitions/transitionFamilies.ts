import { TransitionFamily, TransitionId } from "@/transitions/transition.types";

/**
 * Exhaustive per-id → visual family mapping — TypeScript enforces every
 * `TransitionId` has an entry, so adding a new conceptual transition without
 * classifying its family is a compile error, not a silent gap.
 *
 * This is what lets `TransitionSelector` notice "this would be the 3rd
 * swipe-family cut in a row" even when the exact `TransitionId` keeps
 * changing (e.g. alternating between `whipPan` and `motionBlurSwipe`, which
 * are different ids but both read on screen as a directional wipe/blur) —
 * a plain previous-id/history check on `TransitionId` alone cannot catch
 * that, which was exactly the "it's always the same swipe transition"
 * complaint even though the selector was technically avoiding literal id
 * repeats.
 */
export const TRANSITION_FAMILY: Record<TransitionId, TransitionFamily> = {
  // --- Adventure ---
  mountainReveal: "terrain",
  terrainMask: "terrain",
  cloudWipe: "terrain",
  elevationLift: "terrain",
  valleyReveal: "terrain",
  cinematicSpeedRamp: "speedRamp",
  mapToTerrainDive: "terrain",
  ridgeLineReveal: "terrain",

  // --- Viral ---
  flashCut: "flash",
  beatCut: "beat",
  zoomSmash: "zoom",
  whipPan: "whip",
  motionBlurSwipe: "swipe",
  hyperSpeedRamp: "speedRamp",
  glitchPulse: "glitch",
  impactZoom: "zoom",
  snapToBeat: "beat",
  textPopReveal: "textReveal",

  // --- Travel ---
  crossDissolve: "dissolve",
  directionMatch: "flow",
  horizonMatch: "flow",
  landscapeReveal: "reveal",
  locationMorph: "morph",
  softSwipe: "swipe",
  parallaxDrift: "flow",
  mapZoomToPlace: "zoom",
  daylightBlend: "fade",

  // --- Sport ---
  impactCut: "impact",
  jumpCut: "impact",
  velocityBlur: "swipe",
  cornerAttack: "whip",
  trackingSnap: "zoom",
  accelerationRamp: "speedRamp",
  brakeHitCut: "impact",
  dirtSwipe: "swipe",
  shockShakeCut: "glitch",
  povSnap: "zoom",

  // --- Cinematic ---
  fadeThroughDarkness: "fade",
  epicReveal: "reveal",
  cinematicPush: "zoom",
  orbitBlend: "orbit",
  focusShift: "fade",
  slowSpeedRamp: "speedRamp",
  atmosphericFade: "fade",
  shadowWipe: "fade",
  foregroundMask: "dissolve",
  timeOfDayBlend: "fade",

  // --- Luxury ---
  silkFade: "fade",
  lightSweep: "fade",
  reflectionMatch: "dissolve",
  detailToDetail: "dissolve",
  floatingOrbit: "orbit",
  softParallax: "flow",
  elegantCrossfade: "dissolve",
  shadowToLight: "fade",
  premiumReveal: "reveal",
  slowGradientFade: "fade",

  // --- Shared fades ---
  fadeIn: "fade",
  fadeOut: "fade",
  crossFade: "dissolve",
  softFade: "fade",
  fadeThroughBlack: "fade",
};

/** Resolves a conceptual `TransitionId` to its visual family. */
export function transitionFamilyOf(id: TransitionId): TransitionFamily {
  return TRANSITION_FAMILY[id];
}
