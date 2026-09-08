/**
 * CameraModes — the vocabulary of camera behaviors every StylePreset draws
 * from. Each style deliberately picks a *different* subset of these modes
 * (see `preferredCameraModes` on each `StylePreset`), which is the first
 * thing that makes two styles feel different even before a single
 * transition fires: Adventure moves like a drone over terrain, Viral snaps
 * and punches in, Travel drifts smoothly, Sport chases low and close,
 * Cinematic glides like a crane, Luxury floats and barely moves at all.
 */

export type CameraMode =
  // --- Adventure: terrain is the hero, camera behaves like a scout/drone ---
  | "droneFlyover"
  | "mountainRevealCam"
  | "wideEstablishing"
  | "elevatedChase"
  | "slowOrbitViewpoint"
  | "terrainFollowing"
  // --- Viral: rhythm is the hero, camera behaves like a hype-man ---
  | "fastPushIn"
  | "aggressiveZoom"
  | "snapChange"
  | "whipPanCam"
  | "fastMapJump"
  | "quickPOV"
  | "beforeAfterReveal"
  // --- Travel: the journey is the hero, camera behaves like a calm companion ---
  | "smoothDronePan"
  | "softTracking"
  | "horizonLevel"
  | "gentlePullback"
  | "mapToLandscape"
  | "relaxedOrbit"
  // --- Sport: the athlete/action is the hero, camera behaves like a chase vehicle ---
  | "lowChase"
  | "closeAction"
  | "firstPerson"
  | "sideTracking"
  | "fastCornerFollow"
  | "aggressiveTilt"
  | "terrainLevel"
  // --- Cinematic: emotion/composition is the hero, camera behaves like a film crane ---
  | "stableCrane"
  | "slowPushIn"
  | "wideEstablishingCinematic"
  | "orbitBlendCam"
  | "controlledFlyover"
  | "longLensFeel"
  | "slowReveal"
  | "smoothPullback"
  | "framedSubject"
  // --- Luxury: refinement is the hero, camera behaves like it's floating on silk ---
  | "floatingCamera"
  | "ultraSmoothOrbit"
  | "slowDetailReveal"
  | "elegantTracking"
  | "lowSpeedControlled"
  | "softParallaxCam"
  | "productFraming"
  | "premiumLightMovement";

/** Human-readable description of every camera mode — used for tooltips/debug and to keep each mode's intent explicit rather than a bare string id. */
export const CAMERA_MODE_LIBRARY: Record<CameraMode, string> = {
  droneFlyover: "High aerial pass gliding over the terrain to establish scale.",
  mountainRevealCam: "Camera rises behind a ridge to reveal the peak beyond it.",
  wideEstablishing: "Static-feeling wide shot that lets the landscape breathe.",
  elevatedChase: "Camera trails the subject from slightly above, like a chase drone.",
  slowOrbitViewpoint: "Slow orbit around a scenic viewpoint or summit.",
  terrainFollowing: "Camera hugs the contour of the terrain as it moves.",

  fastPushIn: "Sudden, snappy push toward the subject.",
  aggressiveZoom: "Hard, fast zoom used as a punctuation mark.",
  snapChange: "Instant camera position change with no travel time.",
  whipPanCam: "Extremely fast pan that blurs the frame mid-motion.",
  fastMapJump: "Quick cut/jump across a map view.",
  quickPOV: "Fast point-of-view snap into the action.",
  beforeAfterReveal: "Split-second reveal contrasting two moments.",

  smoothDronePan: "Slow, continuous aerial pan following the direction of travel.",
  softTracking: "Gentle tracking shot that follows a subject at a relaxed pace.",
  horizonLevel: "Camera stays locked to the horizon for a calm, floaty feel.",
  gentlePullback: "Slow pull-back that widens the frame gradually.",
  mapToLandscape: "Smooth blend from a map view into the real landscape.",
  relaxedOrbit: "Slow, wide orbit around a landmark.",

  lowChase: "Low-angle chase camera close to the ground, emphasizing speed.",
  closeAction: "Tight, close framing on the action itself.",
  firstPerson: "First-person / helmet-style point of view.",
  sideTracking: "Side-on tracking shot matching the subject's speed.",
  fastCornerFollow: "Camera whips through a corner alongside the subject.",
  aggressiveTilt: "Sharp tilt used to emphasize gradient or impact.",
  terrainLevel: "Camera sits at terrain height, emphasizing technical ground.",

  stableCrane: "Smooth, weighty crane-like move — no handheld energy.",
  slowPushIn: "Slow, deliberate push toward the subject over several seconds.",
  wideEstablishingCinematic: "Long, patient wide shot that lets a scene set in.",
  orbitBlendCam: "Slow orbit that blends into the next shot's camera direction.",
  controlledFlyover: "Measured aerial pass, slower and steadier than Adventure's.",
  longLensFeel: "Compressed, long-lens perspective isolating the subject.",
  slowReveal: "Gradual reveal of the subject or landscape via slow movement.",
  smoothPullback: "Slow pull-back used to close a scene with scale.",
  framedSubject: "Carefully composed, static-feeling frame around the subject.",

  floatingCamera: "Weightless, gimbal-smooth drift with no sudden movement.",
  ultraSmoothOrbit: "Extremely slow, glass-smooth orbit around the subject.",
  slowDetailReveal: "Slow macro-style reveal of a refined detail.",
  elegantTracking: "Measured, refined tracking shot at low speed.",
  lowSpeedControlled: "Deliberately slow, fully controlled camera move.",
  softParallaxCam: "Subtle parallax drift between foreground and background.",
  productFraming: "Framing style borrowed from premium product photography.",
  premiumLightMovement: "Camera move motivated by how light rakes across a surface.",
};
