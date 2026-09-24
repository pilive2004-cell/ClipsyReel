"use client";

import type { BestMoment, ReelStyle, RenderCreativityLevel, ViralCreativeMetadata, ViralStyleDNA } from "@/types";

export type CreativeTransitionOverlayVariant =
  | "zoom"
  | "whip-pan"
  | "blur"
  | "glitch"
  | "flash"
  | "swipe"
  | "motion-blur"
  | "speed-ramp";

export type CreativeTransitionDirection = "left" | "right" | "up" | "down";

export type CreativeCameraMove =
  | "slow-zoom-in"
  | "fast-zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "vertical-move"
  | "dynamic-crop";

export type CreativeOverlayAnimation = "slide-in" | "scale-in" | "bounce-in" | "swipe-in" | "dynamic-reveal";
export type CreativeOverlayAnchor = "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";

export interface CreativeVariabilitySettings {
  renderCreativityLevel?: RenderCreativityLevel;
  viralStyleDNA?: ViralStyleDNA;
  editingSeed?: string;
  generateVersions?: number;
}

export interface CreativeVersionScore {
  visualDynamics: number;
  motionConsistency: number;
  beatSynchronization: number;
  engagementScore: number;
  total: number;
}

export interface CreativeTransitionDecision {
  variant: CreativeTransitionOverlayVariant;
  remotionType:
    | "slide"
    | "dissolve"
    | "zoom"
    | "fast-zoom"
    | "motion-blur"
    | "flash-cut"
    | "speed-ramp"
    | "whip-pan"
    | "swipe"
    | "camera-shake"
    | "directional-blur"
    | "glitch"
    | "dynamic-scale";
  direction: CreativeTransitionDirection;
  durationSeconds: number;
}

export interface CreativeVersionPlan {
  index: number;
  label: string;
  dominantTransition: CreativeTransitionOverlayVariant;
  transitions: CreativeTransitionDecision[];
  cameraMoves: CreativeCameraMove[];
  titleAnimation: CreativeOverlayAnimation;
  hookAnimations: CreativeOverlayAnimation[];
  titleAnchor: CreativeOverlayAnchor;
  hookAnchors: CreativeOverlayAnchor[];
  beatSyncTolerance: number;
  clipDurationMultiplier: number;
  overlayDurationMultiplier: number;
  overlayStartJitterSeconds: number;
  zoomIntensityMultiplier: number;
  zoomMode: "in" | "out" | "alternate";
  contrast: number;
  saturation: number;
  vibrance: number;
  lut: string;
  storytellingRhythm: string;
  score: CreativeVersionScore;
}

export interface CreativeVariabilityPlan {
  seed: string;
  creativityLevel: RenderCreativityLevel;
  styleDNA: ViralStyleDNA;
  generateVersions: number;
  selectedVersion: CreativeVersionPlan;
  versions: CreativeVersionPlan[];
}

const DEFAULT_SETTINGS: Required<CreativeVariabilitySettings> = {
  renderCreativityLevel: "MEDIUM",
  viralStyleDNA: "TIKTOK_FAST",
  editingSeed: "clipsyreel-default",
  generateVersions: 3,
};

const ALL_TRANSITIONS: CreativeTransitionOverlayVariant[] = [
  "zoom",
  "whip-pan",
  "blur",
  "glitch",
  "flash",
  "swipe",
  "motion-blur",
  "speed-ramp",
];

const ALL_CAMERA_MOVES: CreativeCameraMove[] = [
  "slow-zoom-in",
  "fast-zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "vertical-move",
  "dynamic-crop",
];

const ALL_OVERLAY_ANIMATIONS: CreativeOverlayAnimation[] = [
  "slide-in",
  "scale-in",
  "bounce-in",
  "swipe-in",
  "dynamic-reveal",
];

const ALL_ANCHORS: CreativeOverlayAnchor[] = [
  "top-left",
  "top-right",
  "center",
  "bottom-left",
  "bottom-right",
];

const STYLE_DNA_PROFILES: Record<
  ViralStyleDNA,
  {
    transitions: CreativeTransitionOverlayVariant[];
    cameraMoves: CreativeCameraMove[];
    overlayAnimations: CreativeOverlayAnimation[];
    titleAnchors: CreativeOverlayAnchor[];
    hookAnchors: CreativeOverlayAnchor[];
    zoomModes: Array<"in" | "out" | "alternate">;
    rhythm: string[];
    color: { contrast: number; saturation: number; vibrance: number; luts: string[] };
  }
> = {
  TIKTOK_FAST: {
    transitions: ["zoom", "flash", "swipe", "motion-blur", "speed-ramp"],
    cameraMoves: ["fast-zoom-in", "dynamic-crop", "pan-right", "vertical-move"],
    overlayAnimations: ["swipe-in", "bounce-in", "dynamic-reveal"],
    titleAnchors: ["center", "top-left"],
    hookAnchors: ["center", "bottom-left", "bottom-right"],
    zoomModes: ["in", "alternate"],
    rhythm: ["aggressive micro-cuts", "hook-first pacing", "staccato beat hits"],
    color: { contrast: 1.22, saturation: 1.18, vibrance: 1.12, luts: ["urban-pop", "neon-kick"] },
  },
  CAPCUT_TRENDING: {
    transitions: ["swipe", "zoom", "blur", "flash", "motion-blur"],
    cameraMoves: ["slow-zoom-in", "fast-zoom-in", "dynamic-crop", "pan-left"],
    overlayAnimations: ["slide-in", "swipe-in", "scale-in"],
    titleAnchors: ["top-left", "center"],
    hookAnchors: ["bottom-left", "bottom-right", "center"],
    zoomModes: ["alternate", "in"],
    rhythm: ["trend cadence", "clean snap edits", "beat-led loop timing"],
    color: { contrast: 1.18, saturation: 1.14, vibrance: 1.1, luts: ["creator-clean", "vivid-social"] },
  },
  REDBULL_ACTION: {
    transitions: ["whip-pan", "speed-ramp", "glitch", "flash", "motion-blur"],
    cameraMoves: ["fast-zoom-in", "pan-right", "dynamic-crop", "vertical-move"],
    overlayAnimations: ["bounce-in", "swipe-in", "dynamic-reveal"],
    titleAnchors: ["top-left", "top-right"],
    hookAnchors: ["bottom-right", "bottom-left"],
    zoomModes: ["in", "alternate"],
    rhythm: ["impact surges", "action spikes", "peak-driven acceleration"],
    color: { contrast: 1.26, saturation: 1.2, vibrance: 1.14, luts: ["action-boost", "stadium-burst"] },
  },
  DJI_TRAVEL: {
    transitions: ["zoom", "blur", "swipe", "motion-blur", "flash"],
    cameraMoves: ["slow-zoom-in", "zoom-out", "pan-left", "pan-right"],
    overlayAnimations: ["slide-in", "scale-in", "dynamic-reveal"],
    titleAnchors: ["top-left", "center"],
    hookAnchors: ["bottom-left", "center"],
    zoomModes: ["out", "alternate"],
    rhythm: ["glide pacing", "airborne flow", "scenic breath with pulses"],
    color: { contrast: 1.12, saturation: 1.08, vibrance: 1.06, luts: ["skyline-cool", "travel-gold"] },
  },
  GO_PRO_ADVENTURE: {
    transitions: ["speed-ramp", "whip-pan", "blur", "zoom", "motion-blur"],
    cameraMoves: ["fast-zoom-in", "dynamic-crop", "pan-left", "vertical-move"],
    overlayAnimations: ["swipe-in", "bounce-in", "slide-in"],
    titleAnchors: ["top-right", "top-left"],
    hookAnchors: ["bottom-left", "bottom-right"],
    zoomModes: ["in", "alternate"],
    rhythm: ["terrain bursts", "rush pacing", "ride-and-reveal cadence"],
    color: { contrast: 1.2, saturation: 1.16, vibrance: 1.12, luts: ["trail-boost", "dusty-adrenaline"] },
  },
  CINEMATIC_EPIC: {
    transitions: ["zoom", "motion-blur", "flash", "blur", "swipe"],
    cameraMoves: ["slow-zoom-in", "zoom-out", "pan-left", "pan-right"],
    overlayAnimations: ["scale-in", "dynamic-reveal", "slide-in"],
    titleAnchors: ["center", "top-left"],
    hookAnchors: ["center", "bottom-left"],
    zoomModes: ["out", "alternate"],
    rhythm: ["epic rise", "hero beat spacing", "cinematic swell"],
    color: { contrast: 1.16, saturation: 1.04, vibrance: 1.02, luts: ["epic-cool", "silver-hero"] },
  },
  MOTORCYCLE_RALLY: {
    transitions: ["whip-pan", "speed-ramp", "flash", "glitch", "motion-blur"],
    cameraMoves: ["fast-zoom-in", "pan-right", "vertical-move", "dynamic-crop"],
    overlayAnimations: ["bounce-in", "swipe-in", "dynamic-reveal"],
    titleAnchors: ["top-left", "top-right"],
    hookAnchors: ["bottom-right", "center", "bottom-left"],
    zoomModes: ["in", "alternate"],
    rhythm: ["rally blasts", "torque pulses", "corner-attack rhythm"],
    color: { contrast: 1.24, saturation: 1.14, vibrance: 1.1, luts: ["rally-dust", "engine-heat"] },
  },
};

const CREATIVITY_LEVEL_PROFILES: Record<
  RenderCreativityLevel,
  {
    extraTransitions: number;
    cameraVariety: number;
    overlayVariety: number;
    beatTolerance: [number, number];
    clipDurationMultiplier: [number, number];
    overlayDurationMultiplier: [number, number];
    overlayJitter: [number, number];
    zoomIntensityMultiplier: [number, number];
    colorVariation: number;
    versionCap: number;
  }
> = {
  LOW: {
    extraTransitions: 1,
    cameraVariety: 2,
    overlayVariety: 2,
    beatTolerance: [0.03, 0.08],
    clipDurationMultiplier: [0.95, 1.05],
    overlayDurationMultiplier: [0.94, 1.04],
    overlayJitter: [0.02, 0.08],
    zoomIntensityMultiplier: [0.94, 1.05],
    colorVariation: 0.03,
    versionCap: 2,
  },
  MEDIUM: {
    extraTransitions: 2,
    cameraVariety: 3,
    overlayVariety: 3,
    beatTolerance: [0.05, 0.14],
    clipDurationMultiplier: [0.88, 1.12],
    overlayDurationMultiplier: [0.88, 1.12],
    overlayJitter: [0.05, 0.16],
    zoomIntensityMultiplier: [0.9, 1.12],
    colorVariation: 0.06,
    versionCap: 3,
  },
  HIGH: {
    extraTransitions: 3,
    cameraVariety: 5,
    overlayVariety: 4,
    beatTolerance: [0.08, 0.22],
    clipDurationMultiplier: [0.8, 1.18],
    overlayDurationMultiplier: [0.82, 1.18],
    overlayJitter: [0.08, 0.24],
    zoomIntensityMultiplier: [0.88, 1.18],
    colorVariation: 0.1,
    versionCap: 4,
  },
  EXTREME: {
    extraTransitions: 5,
    cameraVariety: 7,
    overlayVariety: 5,
    beatTolerance: [0.12, 0.3],
    clipDurationMultiplier: [0.72, 1.26],
    overlayDurationMultiplier: [0.78, 1.24],
    overlayJitter: [0.12, 0.32],
    zoomIntensityMultiplier: [0.84, 1.24],
    colorVariation: 0.14,
    versionCap: 5,
  },
};

const DIRECTION_ORDER: CreativeTransitionDirection[] = ["left", "right", "up", "down"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashString(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function pickDistinct<T>(preferred: T[], fallback: T[], count: number, rng: () => number): T[] {
  const pool = [...preferred];
  for (const item of fallback) {
    if (!pool.includes(item)) pool.push(item);
  }
  const target = Math.max(1, Math.min(count, pool.length));
  const chosen: T[] = [];
  while (chosen.length < target && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    const [item] = pool.splice(index, 1);
    chosen.push(item);
  }
  return chosen;
}

function mapVariantToRemotionType(variant: CreativeTransitionOverlayVariant, rng: () => number): CreativeTransitionDecision["remotionType"] {
  if (variant === "zoom") return rng() > 0.45 ? "fast-zoom" : "dynamic-scale";
  if (variant === "whip-pan") return rng() > 0.35 ? "whip-pan" : "camera-shake";
  if (variant === "blur") return rng() > 0.45 ? "directional-blur" : "dissolve";
  if (variant === "glitch") return "glitch";
  if (variant === "flash") return "flash-cut";
  if (variant === "swipe") return rng() > 0.45 ? "swipe" : "slide";
  if (variant === "motion-blur") return "motion-blur";
  return "speed-ramp";
}

function normalizedEnergy(moment: BestMoment | undefined): number {
  if (!moment) return 0.55;
  const breakdown = moment.scoreBreakdown;
  if (!breakdown) return clamp(moment.confidence / 100, 0.2, 1);
  const motion = breakdown.motionIntensity ?? breakdown.motion ?? 0.45;
  const scene = breakdown.sceneChange ?? breakdown.visualImpact ?? 0.45;
  const clarity = breakdown.clarity ?? 0.6;
  const contrast = breakdown.contrast ?? 0.55;
  return clamp(motion * 0.35 + scene * 0.35 + clarity * 0.15 + contrast * 0.15, 0.15, 1);
}

function scoreVersion({
  transitions,
  cameraMoves,
  beatSyncTolerance,
  clipDurationMultiplier,
  moments,
  creativityLevel,
}: {
  transitions: CreativeTransitionDecision[];
  cameraMoves: CreativeCameraMove[];
  beatSyncTolerance: number;
  clipDurationMultiplier: number;
  moments: BestMoment[];
  creativityLevel: RenderCreativityLevel;
}): CreativeVersionScore {
  const levelTarget = creativityLevel === "LOW" ? 0.08 : creativityLevel === "MEDIUM" ? 0.14 : creativityLevel === "HIGH" ? 0.2 : 0.26;
  const uniqueTransitions = transitions.length > 0 ? new Set(transitions.map((transition) => transition.variant)).size / transitions.length : 0.4;
  const uniqueCameras = cameraMoves.length > 0 ? new Set(cameraMoves).size / cameraMoves.length : 0.4;
  const energies = moments.map(normalizedEnergy);
  const motionConsistency =
    energies.length > 0
      ? energies.reduce((sum, energy, index) => {
          const move = cameraMoves[index % Math.max(cameraMoves.length, 1)] ?? "slow-zoom-in";
          const target =
            move === "fast-zoom-in" || move === "dynamic-crop"
              ? 0.82
              : move === "pan-left" || move === "pan-right" || move === "vertical-move"
                ? 0.62
                : move === "zoom-out"
                  ? 0.44
                  : 0.52;
          return sum + (1 - Math.abs(target - energy));
        }, 0) / energies.length
      : 0.72;
  const beatSynchronization = 1 - Math.min(1, Math.abs(beatSyncTolerance - levelTarget) / 0.28);
  const clipAggression = 1 - Math.min(1, Math.abs(clipDurationMultiplier - (creativityLevel === "LOW" ? 1 : creativityLevel === "EXTREME" ? 0.86 : 0.94)) / 0.34);
  const visualDynamics = clamp(uniqueTransitions * 0.55 + uniqueCameras * 0.25 + clipAggression * 0.2, 0, 1);
  const engagementScore = clamp(visualDynamics * 0.45 + motionConsistency * 0.3 + beatSynchronization * 0.25, 0, 1);
  const total = clamp(visualDynamics * 0.35 + motionConsistency * 0.25 + beatSynchronization * 0.2 + engagementScore * 0.2, 0, 1);
  return {
    visualDynamics: Math.round(visualDynamics * 100),
    motionConsistency: Math.round(motionConsistency * 100),
    beatSynchronization: Math.round(beatSynchronization * 100),
    engagementScore: Math.round(engagementScore * 100),
    total: Math.round(total * 100),
  };
}

function buildVersionPlan(
  index: number,
  seed: string,
  styleDNA: ViralStyleDNA,
  creativityLevel: RenderCreativityLevel,
  moments: BestMoment[],
  clipCount: number,
  overlayCount: number
): CreativeVersionPlan {
  const profile = STYLE_DNA_PROFILES[styleDNA];
  const levelProfile = CREATIVITY_LEVEL_PROFILES[creativityLevel];
  const rng = mulberry32(hashString(`${seed}:${styleDNA}:${creativityLevel}:${index}`));
  const availableTransitions = pickDistinct(
    profile.transitions,
    ALL_TRANSITIONS,
    Math.min(profile.transitions.length + levelProfile.extraTransitions, ALL_TRANSITIONS.length),
    rng
  );
  const availableCameras = pickDistinct(
    profile.cameraMoves,
    ALL_CAMERA_MOVES,
    Math.min(profile.cameraMoves.length + levelProfile.cameraVariety, ALL_CAMERA_MOVES.length),
    rng
  );
  const availableAnimations = pickDistinct(
    profile.overlayAnimations,
    ALL_OVERLAY_ANIMATIONS,
    Math.min(profile.overlayAnimations.length + levelProfile.overlayVariety, ALL_OVERLAY_ANIMATIONS.length),
    rng
  );

  const transitionCount = Math.max(0, clipCount - 1);
  const transitions: CreativeTransitionDecision[] = [];
  let previousVariant: CreativeTransitionOverlayVariant | null = null;
  for (let i = 0; i < transitionCount; i++) {
    const energy = normalizedEnergy(moments[i + 1] ?? moments[i]);
    let variant = pickOne(availableTransitions, rng);
    if (previousVariant && availableTransitions.length > 1 && variant === previousVariant) {
      const alternatives = availableTransitions.filter((item) => item !== previousVariant);
      variant = pickOne(alternatives, rng);
    }
    previousVariant = variant;
    transitions.push({
      variant,
      remotionType: mapVariantToRemotionType(variant, rng),
      direction: DIRECTION_ORDER[(i + Math.floor(rng() * DIRECTION_ORDER.length)) % DIRECTION_ORDER.length],
      durationSeconds: Number(clamp(0.15 + energy * 0.28 + rng() * 0.18, 0.15, 0.6).toFixed(3)),
    });
  }

  const cameraMoves = Array.from({ length: Math.max(1, clipCount) }, (_, clipIndex) => {
    const energy = normalizedEnergy(moments[clipIndex]);
    const boostedPool =
      energy >= 0.75
        ? availableCameras.filter((move) => move !== "slow-zoom-in" && move !== "zoom-out")
        : energy <= 0.38
          ? availableCameras.filter((move) => move !== "fast-zoom-in" && move !== "dynamic-crop")
          : availableCameras;
    return pickOne(boostedPool.length > 0 ? boostedPool : availableCameras, rng);
  });

  const hookAnimations = Array.from({ length: Math.max(1, overlayCount) }, () => pickOne(availableAnimations, rng));
  const titleAnimation = pickOne(availableAnimations, rng);
  const titleAnchor = pickOne(profile.titleAnchors, rng);
  const hookAnchors = Array.from({ length: Math.max(1, overlayCount) }, (_, itemIndex) => {
    const pool = itemIndex % 2 === 0 ? profile.hookAnchors : [...profile.hookAnchors].reverse();
    return pickOne(pool, rng);
  });
  const beatSyncTolerance = Number((levelProfile.beatTolerance[0] + rng() * (levelProfile.beatTolerance[1] - levelProfile.beatTolerance[0])).toFixed(3));
  const clipDurationMultiplier = Number((levelProfile.clipDurationMultiplier[0] + rng() * (levelProfile.clipDurationMultiplier[1] - levelProfile.clipDurationMultiplier[0])).toFixed(3));
  const overlayDurationMultiplier = Number((levelProfile.overlayDurationMultiplier[0] + rng() * (levelProfile.overlayDurationMultiplier[1] - levelProfile.overlayDurationMultiplier[0])).toFixed(3));
  const overlayStartJitterSeconds = Number((levelProfile.overlayJitter[0] + rng() * (levelProfile.overlayJitter[1] - levelProfile.overlayJitter[0])).toFixed(3));
  const zoomIntensityMultiplier = Number((levelProfile.zoomIntensityMultiplier[0] + rng() * (levelProfile.zoomIntensityMultiplier[1] - levelProfile.zoomIntensityMultiplier[0])).toFixed(3));

  const contrast = Number((profile.color.contrast + (rng() - 0.5) * levelProfile.colorVariation).toFixed(3));
  const saturation = Number((profile.color.saturation + (rng() - 0.5) * levelProfile.colorVariation).toFixed(3));
  const vibrance = Number((profile.color.vibrance + (rng() - 0.5) * levelProfile.colorVariation).toFixed(3));
  const dominantTransition = transitions[0]?.variant ?? pickOne(profile.transitions, rng);
  const storytellingRhythm = pickOne(profile.rhythm, rng);

  const score = scoreVersion({
    transitions,
    cameraMoves,
    beatSyncTolerance,
    clipDurationMultiplier,
    moments,
    creativityLevel,
  });

  return {
    index,
    label: `${dominantTransition.replace(/-/g, " ")} • ${storytellingRhythm}`,
    dominantTransition,
    transitions,
    cameraMoves,
    titleAnimation,
    hookAnimations,
    titleAnchor,
    hookAnchors,
    beatSyncTolerance,
    clipDurationMultiplier,
    overlayDurationMultiplier,
    overlayStartJitterSeconds,
    zoomIntensityMultiplier,
    zoomMode: pickOne(profile.zoomModes, rng),
    contrast,
    saturation,
    vibrance,
    lut: pickOne(profile.color.luts, rng),
    storytellingRhythm,
    score,
  };
}

export function normalizeCreativeVariabilitySettings(settings?: CreativeVariabilitySettings): Required<CreativeVariabilitySettings> {
  return {
    renderCreativityLevel: settings?.renderCreativityLevel ?? DEFAULT_SETTINGS.renderCreativityLevel,
    viralStyleDNA: settings?.viralStyleDNA ?? DEFAULT_SETTINGS.viralStyleDNA,
    editingSeed: settings?.editingSeed?.trim() || DEFAULT_SETTINGS.editingSeed,
    generateVersions: clamp(Math.round(settings?.generateVersions ?? DEFAULT_SETTINGS.generateVersions), 1, 5),
  };
}

export function buildCreativeVariabilityPlan({
  style,
  moments = [],
  clipCount,
  overlayCount,
  settings,
}: {
  style: ReelStyle;
  moments?: BestMoment[];
  clipCount: number;
  overlayCount: number;
  settings?: CreativeVariabilitySettings;
}): CreativeVariabilityPlan | null {
  if (style !== "viral") return null;
  const normalized = normalizeCreativeVariabilitySettings(settings);
  const levelProfile = CREATIVITY_LEVEL_PROFILES[normalized.renderCreativityLevel];
  const generateVersions = clamp(normalized.generateVersions, 1, levelProfile.versionCap);
  const versions = Array.from({ length: generateVersions }, (_, index) =>
    buildVersionPlan(index, normalized.editingSeed, normalized.viralStyleDNA, normalized.renderCreativityLevel, moments, clipCount, overlayCount)
  );
  const selectedVersion = versions.reduce((best, current) => (current.score.total > best.score.total ? current : best), versions[0]);
  return {
    seed: normalized.editingSeed,
    creativityLevel: normalized.renderCreativityLevel,
    styleDNA: normalized.viralStyleDNA,
    generateVersions,
    selectedVersion,
    versions,
  };
}

export function createEditingSeed() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    return `${array[0].toString(36)}-${array[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildCreativeColorFilter(variation: Pick<CreativeVersionPlan, "contrast" | "saturation" | "vibrance" | "lut">) {
  const base = `eq=contrast=${variation.contrast.toFixed(3)}:saturation=${variation.saturation.toFixed(3)}:gamma=${clamp(0.96 + (variation.vibrance - 1) * 0.35, 0.9, 1.1).toFixed(3)}:brightness=${clamp((variation.vibrance - 1) * 0.03, -0.03, 0.04).toFixed(3)}`;
  if (variation.lut === "urban-pop" || variation.lut === "creator-clean") return `${base},colorbalance=rs=0.03:bs=-0.03`;
  if (variation.lut === "neon-kick" || variation.lut === "vivid-social") return `${base},colorbalance=rs=0.04:gs=-0.02:bs=0.03`;
  if (variation.lut === "action-boost" || variation.lut === "stadium-burst") return `${base},colorbalance=rs=0.05:bs=-0.04:rm=0.02`;
  if (variation.lut === "skyline-cool" || variation.lut === "epic-cool" || variation.lut === "silver-hero") return `${base},colorbalance=bs=0.06:bm=0.03`;
  if (variation.lut === "travel-gold" || variation.lut === "trail-boost" || variation.lut === "dusty-adrenaline" || variation.lut === "rally-dust" || variation.lut === "engine-heat") {
    return `${base},colorbalance=rs=0.08:gs=0.01:bs=-0.06:rm=0.03`;
  }
  return base;
}

export function toCreativeMetadata(plan: CreativeVariabilityPlan): ViralCreativeMetadata {
  return {
    editingSeed: plan.seed,
    renderCreativityLevel: plan.creativityLevel,
    viralStyleDNA: plan.styleDNA,
    generateVersions: plan.generateVersions,
    selectedVersionIndex: plan.selectedVersion.index,
    selectedVersionLabel: plan.selectedVersion.label,
    dominantTransition: plan.selectedVersion.dominantTransition,
    storytellingRhythm: plan.selectedVersion.storytellingRhythm,
    colorLut: plan.selectedVersion.lut,
    beatSyncTolerance: plan.selectedVersion.beatSyncTolerance,
    versionScore: plan.selectedVersion.score.total,
  };
}
