import { StylePreset } from "@/types/style.types";

/**
 * Adventure — "The landscape is the hero."
 *
 * Every transition is physically anchored to real terrain (a ridge, a
 * valley, a cloud bank, an elevation change) rather than being a generic
 * digital effect — this is what makes Adventure read as *exploration*
 * rather than just "outdoorsy footage with fast cuts". Medium rhythm and a
 * slow-fast-slow speed ramp give it room to let a big view breathe while
 * still feeling alive, which is deliberately different from Cinematic's
 * much slower, more restrained pacing.
 */
export const adventurePreset: StylePreset = {
  styleId: "adventure",
  displayName: "Adventure",
  emotionalGoal: "Exploration, altitude, distance, freedom and discovery.",
  visualSignature: "The landscape is the hero.",
  averageShotDuration: 3.9,
  minShotDuration: 2.6,
  maxShotDuration: 6.0,
  transitionIntensity: 7,
  cameraEnergy: 6,
  preferredCameraModes: [
    "droneFlyover",
    "mountainRevealCam",
    "wideEstablishing",
    "elevatedChase",
    "slowOrbitViewpoint",
    "terrainFollowing",
  ],
  preferredTransitions: [
    "mountainReveal",
    "terrainMask",
    "cloudWipe",
    "elevationLift",
    "valleyReveal",
    "cinematicSpeedRamp",
    "mapToTerrainDive",
    "ridgeLineReveal",
  ],
  // The 5 explicitly "must prefer" terrain signatures for Adventure.
  corePreferredTransitions: ["mountainReveal", "terrainMask", "elevationLift", "valleyReveal", "mapToTerrainDive"],
  // Never a Viral punch-zoom, a Luxury slow fade, or a wall of hard cuts — those would fight the "terrain is the hero" signature.
  forbiddenTransitions: [
    "zoomSmash",
    "impactZoom",
    "hyperSpeedRamp",
    "silkFade",
    "slowGradientFade",
    "floatingOrbit",
    "flashCut",
    "beatCut",
    "glitchPulse",
  ],
  preferredTransitionCategories: ["terrain"],
  speedRampBehavior: "slowFastSlow",
  speedRampLevel: 6,
  motionBlurAmount: 4,
  transitionDurationRange: [0.8, 1.8],
  beatSyncPriority: 3,
  terrainUsagePriority: 10,
  elegancePriority: 4,
  actionPriority: 6,
  smoothnessPriority: 5,
  colorMood: "Warm, natural, sun-and-earth tones — golden hour amber and alpine blue.",
  lightingMood: "Directional natural light, long shadows, real weather.",
  overlayBehavior: "Route stat cards and elevation callouts, understated typography.",
  musicSyncBehavior: "eventDriven",
  recommendedUseCases: ["Hiking / trekking recaps", "Motorcycle & overland trips", "Mountain biking journeys", "Road trips through varied terrain"],
};
