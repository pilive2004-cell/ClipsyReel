import { StylePreset } from "@/types/style.types";

/**
 * Sport — "The rider/driver/action is the hero."
 *
 * Every transition here is `event-driven`: it exists to react to something
 * that actually happened in the GPX/motion data (a hard corner, a jump, a
 * braking event, a technical section) rather than firing on a fixed
 * schedule like Viral's beat grid. That's the key difference between the
 * two fastest styles in the system — Viral is rhythm-first, Sport is
 * action-first.
 */
export const sportPreset: StylePreset = {
  styleId: "sport",
  displayName: "Sport",
  emotionalGoal: "Speed, adrenaline, precision, danger and physical performance.",
  visualSignature: "The rider, driver or action is the hero.",
  averageShotDuration: 4.4,
  minShotDuration: 3.2,
  maxShotDuration: 5.2,
  transitionIntensity: 9,
  cameraEnergy: 9,
  preferredCameraModes: ["lowChase", "closeAction", "firstPerson", "sideTracking", "fastCornerFollow", "aggressiveTilt", "terrainLevel"],
  preferredTransitions: [
    "impactCut",
    "jumpCut",
    "velocityBlur",
    "cornerAttack",
    "trackingSnap",
    "accelerationRamp",
    "brakeHitCut",
    "dirtSwipe",
    "shockShakeCut",
    "povSnap",
  ],
  // No soft dissolves, no luxury light sweeps — those would sap all the adrenaline out of an action beat.
  forbiddenTransitions: ["crossDissolve", "softSwipe", "daylightBlend", "lightSweep", "silkFade", "floatingOrbit", "slowGradientFade"],
  // The 5 explicitly "must prefer" action signatures for Sport.
  corePreferredTransitions: ["impactCut", "velocityBlur", "cornerAttack", "accelerationRamp", "shockShakeCut"],
  preferredTransitionCategories: ["action"],
  speedRampBehavior: "impactDriven",
  speedRampLevel: 9,
  motionBlurAmount: 7,
  transitionDurationRange: [0.6, 1.4],
  beatSyncPriority: 5,
  terrainUsagePriority: 2,
  elegancePriority: 1,
  actionPriority: 10,
  smoothnessPriority: 2,
  colorMood: "High-energy punch — deep contrast, cool-toned highlights on sweat/metal/dirt.",
  lightingMood: "Hard, directional, slightly gritty — sports-broadcast lighting.",
  overlayBehavior: "HUD-style speed/gradient/heart-rate readouts, minimal chrome.",
  musicSyncBehavior: "eventDriven",
  recommendedUseCases: ["Motocross / MTB runs", "Ski & snowboard descents", "Track days & racing", "Any high-speed action GPX activity"],
};
