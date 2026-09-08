import { ReelStyle } from "@/types";

/**
 * The "Creative Style Engine" (see `src/lib/creative-style-engine.ts`) uses
 * this file to decide *how* a style edits a montage beyond just picking a
 * transition pool — color grade, freeze-frame drama, speed ramps, and global
 * visual treatments (letterbox, film grain, light leaks, HUD) all come from
 * here, keyed per `ReelStyle`, so every style produces a genuinely different
 * looking/feeling Reel instead of just different text and colors.
 */

/** Whole-montage color grade — picked once per style (not per clip) and baked into every clip during Phase 1 of `buildMontage`. */
export type ColorTreatment = "standard" | "highContrastPunchy" | "warmTravel" | "premiumMuted" | "cinematicMoody";

export type Typography = "bold-sans" | "elegant-serif" | "technical-mono";

export interface CreativeStyleProfile {
  id: ReelStyle;
  rhythm: "very-fast" | "fast" | "medium" | "slow";
  colorTreatment: ColorTreatment;
  /** Ramps saturation to 0 over the final ~1.6s of the whole montage — a cinematic/luxury "color drains to memory" reveal. */
  bwReveal: boolean;
  /** Freezes the strongest-confidence ("highlight") clip for a dramatic beat before its transition. */
  freezeHighlight: boolean;
  /** Freezes the very first frame with a burned-in hook text card before the Reel starts moving — a classic "stop the scroll" opener. */
  openerHookFreeze: boolean;
  /** Ends the Reel on a single freeze-framed, polaroid-bordered "memory" card (simplified stand-in for a full multi-frame collage — see comment in creative-style-engine.ts). */
  polaroidEnding: boolean;
  speedRamp: "speedup-build" | "slowdown-highlight" | "dynamicMix" | "none";
  letterbox: boolean;
  filmGrain: boolean;
  lightLeaks: boolean;
  /** Sport-style corner HUD graphic (fake telemetry/REC dot), burned in as a global overlay across the whole montage. */
  hud: boolean;
  /** Opening route/distance stat card generated from parsed GPX data (Pro + GPX upload required). */
  gpsRouteCard: boolean;
  typography: Typography;
  /** Human-readable chips describing what this style *does*, shown in the UI (style picker + render summary) so the difference between styles is obvious before rendering even starts. `pro: true` chips are greyed out / lock-badged for Free users. */
  summary: { icon: string; label: string; pro: boolean }[];
}

export const CREATIVE_STYLE_PROFILES: Record<ReelStyle, CreativeStyleProfile> = {
  viral: {
    id: "viral",
    rhythm: "very-fast",
    colorTreatment: "highContrastPunchy",
    bwReveal: false,
    freezeHighlight: true,
    openerHookFreeze: true,
    polaroidEnding: false,
    speedRamp: "speedup-build",
    letterbox: false,
    filmGrain: false,
    lightLeaks: false,
    hud: false,
    gpsRouteCard: false,
    typography: "bold-sans",
    summary: [
      { icon: "⚡️", label: "Flash-cut zoom transitions", pro: false },
      { icon: "🧊", label: "Freeze-frame hook opener", pro: true },
      { icon: "🔥", label: "High-contrast, saturated grade", pro: false },
      { icon: "⏩", label: "Speed-ramped pacing", pro: true },
    ],
  },
  travel: {
    id: "travel",
    rhythm: "medium",
    colorTreatment: "warmTravel",
    bwReveal: false,
    freezeHighlight: true,
    openerHookFreeze: false,
    polaroidEnding: true,
    speedRamp: "none",
    letterbox: false,
    filmGrain: false,
    lightLeaks: true,
    hud: false,
    gpsRouteCard: true,
    typography: "elegant-serif",
    summary: [
      { icon: "🌅", label: "Warm, dreamy color grade", pro: false },
      { icon: "🖼️", label: "Polaroid-style memory ending", pro: true },
      { icon: "✨", label: "Soft light leaks", pro: true },
      { icon: "📍", label: "Route & distance overlay", pro: true },
    ],
  },
  adventure: {
    id: "adventure",
    rhythm: "fast",
    colorTreatment: "warmTravel",
    bwReveal: false,
    freezeHighlight: true,
    openerHookFreeze: false,
    polaroidEnding: true,
    speedRamp: "dynamicMix",
    letterbox: false,
    filmGrain: false,
    lightLeaks: true,
    hud: false,
    gpsRouteCard: true,
    typography: "elegant-serif",
    summary: [
      { icon: "🗺️", label: "Route stat card intro", pro: true },
      { icon: "🖼️", label: "Polaroid travel-memory ending", pro: true },
      { icon: "🌄", label: "Warm adventure color grade", pro: false },
      { icon: "🐢", label: "Slow-mo on the big moment", pro: true },
      { icon: "✨", label: "Soft light leaks", pro: true },
    ],
  },
  cinematic: {
    id: "cinematic",
    rhythm: "slow",
    colorTreatment: "cinematicMoody",
    bwReveal: true,
    freezeHighlight: true,
    openerHookFreeze: false,
    polaroidEnding: false,
    speedRamp: "slowdown-highlight",
    letterbox: true,
    filmGrain: true,
    lightLeaks: true,
    hud: false,
    gpsRouteCard: false,
    typography: "elegant-serif",
    summary: [
      { icon: "🎞️", label: "Cinematic letterbox bars", pro: true },
      { icon: "🎥", label: "Subtle film grain", pro: true },
      { icon: "⚫️", label: "Color → black & white ending", pro: true },
      { icon: "🐢", label: "Dramatic freeze-frame + slow-mo", pro: true },
      { icon: "✨", label: "Soft light leaks", pro: true },
    ],
  },
  sport: {
    id: "sport",
    rhythm: "fast",
    colorTreatment: "highContrastPunchy",
    bwReveal: false,
    freezeHighlight: false,
    openerHookFreeze: false,
    polaroidEnding: false,
    speedRamp: "speedup-build",
    letterbox: false,
    filmGrain: false,
    lightLeaks: false,
    hud: true,
    gpsRouteCard: false,
    typography: "technical-mono",
    summary: [
      { icon: "🏁", label: "Action-focused fast cuts", pro: false },
      { icon: "📟", label: "HUD-style corner overlay", pro: true },
      { icon: "⏩", label: "Speed-ramped energy", pro: true },
      { icon: "🔥", label: "High-contrast action grade", pro: false },
    ],
  },
  luxury: {
    id: "luxury",
    rhythm: "slow",
    colorTreatment: "premiumMuted",
    bwReveal: true,
    freezeHighlight: false,
    openerHookFreeze: false,
    polaroidEnding: false,
    speedRamp: "none",
    letterbox: true,
    filmGrain: false,
    lightLeaks: false,
    hud: false,
    gpsRouteCard: false,
    typography: "elegant-serif",
    summary: [
      { icon: "💎", label: "Minimal, elegant transitions", pro: false },
      { icon: "🎞️", label: "Premium letterbox framing", pro: true },
      { icon: "⚫️", label: "Refined black & white ending", pro: true },
      { icon: "🕊️", label: "Clean, exclusive typography", pro: true },
    ],
  },
};
