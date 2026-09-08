import { StylePreset, VisualStyleId } from "@/types/style.types";
import { adventurePreset } from "@/styles/adventure.style";
import { viralPreset } from "@/styles/viral.style";
import { travelPreset } from "@/styles/travel.style";
import { sportPreset } from "@/styles/sport.style";
import { cinematicPreset } from "@/styles/cinematic.style";
import { luxuryPreset } from "@/styles/luxury.style";

/** Single registry every other module (selector, engine, UI) reads style presets from — adding a 7th style is a one-line addition here, nothing else needs to change. */
export const STYLE_PRESETS: Record<VisualStyleId, StylePreset> = {
  adventure: adventurePreset,
  viral: viralPreset,
  travel: travelPreset,
  sport: sportPreset,
  cinematic: cinematicPreset,
  luxury: luxuryPreset,
};

export { adventurePreset, viralPreset, travelPreset, sportPreset, cinematicPreset, luxuryPreset };
