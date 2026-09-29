import type { RemotionTemplateStyle } from "@/modules/remotion";
import type { CreativeVariabilityPlan } from "@/lib/creative-variability";

export type RemotionTransitionType =
  | "slide"
  | "dissolve"
  | "zoom"
  | "fast-zoom"
  | "cross-zoom"
  | "motion-blur"
  | "flash-cut"
  | "film-burn"
  | "speed-ramp"
  | "whip-pan"
  | "swipe"
  | "camera-shake"
  | "directional-blur"
  | "glitch"
  | "dynamic-scale";

export interface SelectedRemotionTransition {
  type: RemotionTransitionType;
  duration: number;
  direction: "left" | "right" | "up" | "down";
  energyBand: "low" | "medium" | "high";
}

interface TransitionClipInput {
  id: string;
  energy: number;
  start: number;
  end: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const DIRECTION_ORDER: Array<"left" | "right" | "up" | "down"> = ["left", "right", "up", "down"];

const LOW_ENERGY_TRANSITIONS: RemotionTransitionType[] = ["dissolve", "slide", "dynamic-scale", "zoom"];
const MEDIUM_ENERGY_TRANSITIONS: RemotionTransitionType[] = ["fast-zoom", "motion-blur", "swipe", "directional-blur"];
const HIGH_ENERGY_TRANSITIONS: RemotionTransitionType[] = ["flash-cut", "speed-ramp", "whip-pan", "camera-shake", "glitch"];
const VIRAL_LOW_ENERGY_TRANSITIONS: RemotionTransitionType[] = ["cross-zoom", "film-burn"];
const VIRAL_MEDIUM_ENERGY_TRANSITIONS: RemotionTransitionType[] = ["cross-zoom", "film-burn"];
const VIRAL_HIGH_ENERGY_TRANSITIONS: RemotionTransitionType[] = ["film-burn", "cross-zoom"];

function transitionPoolFor(style: RemotionTemplateStyle, energy: number): RemotionTransitionType[] {
  if (style === "sport") {
    return energy >= 0.7 ? ["whip-pan", "camera-shake", "glitch"] : ["slide", "fast-zoom", "motion-blur"];
  }
  if (style === "viral") {
    if (energy >= 0.72) return VIRAL_HIGH_ENERGY_TRANSITIONS;
    if (energy >= 0.42) return VIRAL_MEDIUM_ENERGY_TRANSITIONS;
    return VIRAL_LOW_ENERGY_TRANSITIONS;
  }
  return energy >= 0.55 ? ["zoom", "dynamic-scale", "dissolve"] : ["slide", "dissolve"];
}

export function buildTransitionSequence(
  clips: TransitionClipInput[],
  style: RemotionTemplateStyle,
  creativityPlan?: CreativeVariabilityPlan | null
): SelectedRemotionTransition[] {
  let previousType: RemotionTransitionType | null = null;
  return clips.slice(1).map((clip, index) => {
    const explicitTransition = creativityPlan?.selectedVersion.transitions[index];
    const pool = transitionPoolFor(style, clip.energy);
    const preferred = explicitTransition?.remotionType ?? pool[index % pool.length];
    const type =
      previousType && pool.length > 1 && preferred === previousType ? pool[(index + 1) % pool.length] : preferred;
    const duration = explicitTransition?.durationSeconds ?? clamp(0.15 + clip.energy * 0.45, 0.15, 0.6);
    const energyBand = clip.energy >= 0.72 ? "high" : clip.energy >= 0.42 ? "medium" : "low";
    previousType = type;
    return {
      type,
      duration,
      direction: explicitTransition?.direction ?? DIRECTION_ORDER[index % DIRECTION_ORDER.length],
      energyBand,
    };
  });
}
