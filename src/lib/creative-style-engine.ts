import { EmotionalStoryRole, GpxRouteStats, ReelStyle } from "@/types";
import { CREATIVE_STYLE_PROFILES, ColorTreatment, Typography } from "@/data/creativeStyleProfiles";
import { EditingPattern, PatternHighlightPlacement, PatternPacing, selectEditingPattern } from "@/data/editingPatterns";

/**
 * The Creative Style Engine.
 *
 * `applyCreativeStyleEngine(timeline, selectedStyle)` is a pure function: it
 * takes the already-planned clip timeline (from `planReelSegments` in
 * `video-engine.ts` — just clip indices + AI confidence scores, nothing
 * ffmpeg-specific) plus the selected style, and returns a decorated
 * "creative timeline plan" describing exactly how that montage should be
 * edited: which clip gets the dramatic freeze-frame, whether the ending
 * fades to black & white or becomes a polaroid-style memory card, which
 * clips speed up/slow down, and which whole-montage visual treatments
 * (color grade, letterbox, film grain, light leaks, HUD) apply.
 *
 * `video-engine.ts` reads this plan while building the real ffmpeg.wasm
 * filter graph (so the exported MP4 actually differs per style, not just
 * its text/colors in the UI). `CreativeStyleEnginePanel` (UI) reads the
 * *style profile* directly via `getCreativeStyleSummary()` to show the user
 * what to expect before rendering even starts.
 *
 * MONETIZATION: every profile effect is individually gated by `isPro` here
 * — Free users still get the style's base color treatment + transitions
 * (the "obviously different styles" requirement holds even on Free), but
 * freeze-frames, speed ramps, endings, and global overlays are Pro-only.
 * Stripped effects are collected into `proLockedEffects` so the UI can show
 * a concrete, specific upsell ("Unlock: Freeze-frame highlight, Film grain…")
 * instead of a generic "upgrade for more" prompt.
 *
 * FUTURE: Remotion could replace the freeze-frame/polaroid/route-card
 * generation in `video-engine.ts` with full React-based compositions (a
 * truly animated map intro that draws the route line, real multi-frame
 * polaroid collage stacking, animated typography). The current version
 * renders honest, simplified equivalents entirely with ffmpeg.wasm +
 * canvas-generated overlay PNGs (see `creative-visuals.ts`) so every effect
 * below ships as a real, exportable MP4 today rather than a UI mockup.
 */

export type ClipRole = "opener" | "build" | "highlight" | "closer";
export type SpeedRampDecision = "none" | "slowmo" | "speedup";

export interface CreativeFreezeFrame {
  holdSeconds: number;
  /** Burns this text into the freeze frame (opener hook cards only). */
  textOverlay: string | null;
  /** Wraps the frozen frame in a polaroid-style bordered card (closer/ending only). */
  polaroid: boolean;
}

export interface CreativeClipPlan {
  index: number;
  role: ClipRole;
  narrativeRole: Exclude<EmotionalStoryRole, "thumbnail-moment"> | "transition-build";
  speedRamp: SpeedRampDecision;
  freezeFrame: CreativeFreezeFrame | null;
}

export interface CreativeIntroPlan {
  type: "routeStatCard";
  title: string;
  subtitle: string;
}

export interface CreativeGlobalOverlays {
  letterbox: boolean;
  filmGrain: boolean;
  lightLeak: boolean;
  hud: boolean;
  /** Ramps saturation to 0 over the final beat of the whole montage. */
  bwReveal: boolean;
}

export interface CreativeTimelinePlan {
  style: ReelStyle;
  typography: Typography;
  /** Whole-montage color grade (see `ColorTreatment`), baked into every clip during Phase 1. */
  colorTreatment: ColorTreatment;
  clips: CreativeClipPlan[];
  intro: CreativeIntroPlan | null;
  overlays: CreativeGlobalOverlays;
  /** Effect labels this style's profile calls for but were stripped because the current user isn't Pro — surface these as a concrete upsell. */
  proLockedEffects: string[];
  /** The Editing Pattern (structural template) chosen for this generation — see `editingPatterns.ts`. Surfaced in the UI so structural variety feels intentional. */
  pattern: { name: string; description: string };
}

/** One entry per planned segment/clip, in final render order (already interleaved across source videos). */
export interface CreativeTimelineClipInput {
  index: number;
  confidence: number;
  /** 0-1 motion/clarity from the best-moment scoring breakdown, when available — used to detect a "chaotic/shaky" clip (high motion + low clarity) for the editing-rule guardrails below. */
  motion?: number;
  clarity?: number;
  narrativeRole?: Exclude<EmotionalStoryRole, "thumbnail-moment"> | null;
}

export interface CreativeStyleEngineTimeline {
  clips: CreativeTimelineClipInput[];
  isPro: boolean;
  gpxStats?: GpxRouteStats | null;
  /** Human-readable route/region label — falls back to a generic label since real reverse-geocoding isn't implemented in this MVP (see comment below). */
  routeLabel?: string | null;
  openerHookText?: string | null;
}

/**
 * Decides *how* to edit a montage for the given style: which clip is the
 * dramatic "highlight", whether the opener/closer get freeze-framed, which
 * clips speed up or slow down, and which global visual treatments apply —
 * all gated by the user's plan.
 */
export function applyCreativeStyleEngine(timeline: CreativeStyleEngineTimeline, selectedStyle: ReelStyle): CreativeTimelinePlan {
  const profile = CREATIVE_STYLE_PROFILES[selectedStyle];
  const pattern: EditingPattern = selectEditingPattern(selectedStyle);
  const { clips } = timeline;
  const n = clips.length;
  const proLockedEffects: string[] = [];

  // Gates a profile flag behind `isPro`, recording the human label if it had to be stripped.
  const gate = (wants: boolean, label: string): boolean => {
    if (!wants) return false;
    if (timeline.isPro) return true;
    if (!proLockedEffects.includes(label)) proLockedEffects.push(label);
    return false;
  };

  const letterbox = gate(profile.letterbox, "Cinematic letterbox bars");
  const filmGrain = gate(profile.filmGrain, "Film grain");
  const lightLeak = gate(profile.lightLeaks, "Soft light leaks");
  const hud = gate(profile.hud, "HUD-style overlay");
  const bwReveal = gate(profile.bwReveal, "Black & white ending reveal");
  const freezeHighlightAllowed = gate(profile.freezeHighlight, "Freeze-frame highlight");
  const openerHookFreezeAllowed = gate(profile.openerHookFreeze && !!timeline.openerHookText, "Freeze-frame hook opener");
  const polaroidAllowed = gate(profile.polaroidEnding, "Polaroid memory ending");
  const speedRampAllowed = gate(profile.speedRamp !== "none", "Speed ramp");
  // If a GPX route exists, always allow a route intro on Pro regardless of style.
  // This keeps the exported film consistent with user expectation: selecting GPX
  // should produce a map intro in the final video, not only on Travel/Adventure.
  const gpsCardAllowed = gate(!!timeline.gpxStats, "Route stat overlay card");

  // The AI detector's confidence score still decides which clip is the
  // "best moment" overall — the Editing Pattern's `highlightPlacement` only
  // decides WHERE in the running order that dramatic beat should land,
  // by preferring the most confident clip within the matching third of the
  // sequence (falling back to the global best if that section is empty).
  // This is what gives two Reels in the same style a different shape —
  // "peak early", "peak late", "peak in the middle" — instead of always
  // freezing on the same relative moment.
  const eligible = clips.filter((c) => c.index !== 0 && c.index !== n - 1);
  const pool = eligible.length > 0 ? eligible : clips;
  const third = Math.max(1, Math.floor(n / 3));
  const sectionOf = (idx: number): PatternHighlightPlacement =>
    idx < third ? "early" : idx < third * 2 ? "middle" : "late";
  const preferredSection = pool.filter((c) => sectionOf(c.index) === pattern.highlightPlacement);
  const searchPool = preferredSection.length > 0 ? preferredSection : pool;

  let highlightIndex = -1;
  let bestConfidence = -Infinity;
  for (const c of searchPool) {
    if (c.confidence > bestConfidence) {
      bestConfidence = c.confidence;
      highlightIndex = c.index;
    }
  }

  const pacingMultiplier: Record<PatternPacing, number> = { accelerate: 0.8, pulse: 0.9, steady: 1, decelerate: 1.25 };
  const holdScale = pacingMultiplier[pattern.pacing];
  // Freeze-frame holds were previously fixed constants for the opener-hook
  // and closer/polaroid beats (0.95s / 1.45s), completely deaf to the
  // style's own rhythm — on Viral (rhythm "very-fast", ~0.5-1s shots) that
  // meant an opener hook freeze alone could sit still for as long as 3-4
  // *entire clips'* worth of screen time, which reads exactly like "the reel
  // is always in slow motion" even though technically it's a freeze, not a
  // `speedRamp`. This scales every freeze-frame hold (highlight, opener
  // hook, closer/polaroid, chaotic-ending fallback) by the same rhythm
  // factor so a freeze stays a proportional accent beat, not a disproportionate pause.
  const rhythmHoldFactor = profile.rhythm === "very-fast" ? 0.5 : profile.rhythm === "fast" ? 0.8 : profile.rhythm === "slow" ? 1.3 : 1;
  const highMotionForRamp = 0.48;
  // Slow-motion is a rarer, more deliberate beat than the speed-up ramp — a
  // higher motion bar means it only fires on a genuinely standout dramatic
  // moment instead of on almost every action clip, keeping it feeling
  // special rather than showing up on every single Reel.
  const highMotionForSlowMo = 0.62;
  let usedSlowMo = false;
  let usedSpeedUpBuilds = 0;

  const clipPlans: CreativeClipPlan[] = clips.map((c) => {
    const isFirst = c.index === 0;
    const isLast = c.index === n - 1;
    const isHighlight = c.index === highlightIndex && !isFirst && !isLast;
    const role: ClipRole = isFirst ? "opener" : isLast ? "closer" : isHighlight ? "highlight" : "build";
    const narrativeRole: Exclude<EmotionalStoryRole, "thumbnail-moment"> | "transition-build" =
      isFirst
        ? "opening-hook"
        : isLast
          ? "emotional-ending"
          : c.narrativeRole ?? (isHighlight ? "peak-moment" : "journey");

    let speedRamp: SpeedRampDecision = "none";
    if (speedRampAllowed) {
      const motion = c.motion ?? 0;
      // dynamicMix (Adventure) deliberately allows 2 speed-up build beats,
      // same as Sport — its whole point is contrasting FAST cuts against
      // the one deliberate slow-mo, rather than a single accelerated clip
      // getting buried among many plain ones. A style with only one dynamic
      // technique in an otherwise uniform reel is exactly what read as
      // "il n'y a que du ralenti" — this gives the edit more visible energy
      // beats to alternate against that one dramatic slow moment.
      const speedUpCap = selectedStyle === "sport" || profile.speedRamp === "dynamicMix" ? 2 : 1;
      if (
        (profile.speedRamp === "speedup-build" || profile.speedRamp === "dynamicMix") &&
        role === "build" &&
        motion >= highMotionForRamp &&
        usedSpeedUpBuilds < speedUpCap &&
        narrativeRole !== "emotional-ending"
      ) {
        speedRamp = "speedup";
        usedSpeedUpBuilds += 1;
      }
      if (
        (profile.speedRamp === "slowdown-highlight" || profile.speedRamp === "dynamicMix") &&
        !usedSlowMo &&
        (narrativeRole === "peak-moment" || narrativeRole === "discovery") &&
        motion >= highMotionForSlowMo
      ) {
        speedRamp = "slowmo";
        usedSlowMo = true;
      }
    }

    const wantsHighlightFreeze = freezeHighlightAllowed && narrativeRole === "peak-moment";
    const freezeFrame: CreativeFreezeFrame | null = wantsHighlightFreeze
      ? {
          holdSeconds: Math.max(0.35, 0.9 * rhythmHoldFactor * holdScale),
          textOverlay: null,
          polaroid: false,
        }
      : null;

    return { index: c.index, role, narrativeRole, speedRamp, freezeFrame };
  });

  // Opener hook freeze (viral): a brief freeze on the very first frame with
  // the hook text burned in, before the Reel starts moving — this REPLACES
  // any highlight freeze the opener clip might otherwise have gotten (an
  // opener is never also tagged "highlight", see role assignment above, so
  // there's no conflict).
  if (openerHookFreezeAllowed && clipPlans[0]) {
    // Floor at 0.5s regardless of rhythm/pacing — even Viral's punchy hook
    // freeze must stay on screen long enough for the hook text to actually
    // be read, it just can't be allowed to balloon into a multi-second pause.
    clipPlans[0].freezeFrame = { holdSeconds: Math.max(0.5, 0.6 * rhythmHoldFactor * holdScale), textOverlay: timeline.openerHookText ?? null, polaroid: false };
  }

  // Polaroid memory ending: freezes the closer clip's final frame into a
  // bordered "photo" beat. Simplified single-photo stand-in for a full
  // multi-frame collage (see file doc comment above).
  if (polaroidAllowed && clipPlans[clipPlans.length - 1]) {
    clipPlans[clipPlans.length - 1].freezeFrame = { holdSeconds: Math.max(0.6, 1.45 * rhythmHoldFactor * holdScale), textOverlay: null, polaroid: true };
  }

  // --- Explicit editing-rule guardrails, applied on top of the per-style profile ---
  // These encode general good-editing principles that hold across every
  // style (rather than being one more per-style knob), so they run as a
  // final pass over the already-built plan:
  //  - never chain more than two "strong" effects (freeze-frame or speed
  //    ramp) back to back — it gets exhausting rather than dynamic;
  //  - never let the montage END on a chaotic/shaky clip (high motion + low
  //    clarity) unless the style is Sport, where that energy IS the point;
  //  - Cinematic and Luxury always get one deliberate "breathing moment" —
  //    a plain clip with no effect — so the slower, premium rhythm those
  //    styles promise doesn't quietly turn into effect-on-effect.
  const CHAOTIC_MOTION = 0.72;
  const CHAOTIC_CLARITY = 0.28;
  const isStrongEffect = (c: CreativeClipPlan) => c.freezeFrame !== null || c.speedRamp !== "none";

  let strongStreak = 0;
  for (const c of clipPlans) {
    if (c.role === "opener" || c.role === "closer") {
      strongStreak = isStrongEffect(c) ? strongStreak + 1 : 0;
      continue;
    }
    if (isStrongEffect(c)) {
      strongStreak += 1;
      if (strongStreak > 2) {
        c.freezeFrame = null;
        c.speedRamp = "none";
        strongStreak = 0;
      }
    } else {
      strongStreak = 0;
    }
  }

  const lastClip = clips.find((c) => c.index === n - 1);
  const closerPlan = clipPlans[clipPlans.length - 1];
  const closerIsChaotic = !!lastClip && (lastClip.motion ?? 0) >= CHAOTIC_MOTION && (lastClip.clarity ?? 1) <= CHAOTIC_CLARITY;
  if (closerIsChaotic && selectedStyle !== "sport" && closerPlan) {
    // Don't amplify the shakiness with a speed ramp; a brief freeze (if this
    // user's plan allows freeze-frames at all) calms the ending down instead
    // of fighting it — the closer freeze from the polaroid-ending block
    // above already covers this for travel/adventure, so only step in when
    // nothing has frozen it yet.
    closerPlan.speedRamp = "none";
    if (!closerPlan.freezeFrame && freezeHighlightAllowed) {
      closerPlan.freezeFrame = { holdSeconds: Math.max(0.4, 0.9 * rhythmHoldFactor * holdScale), textOverlay: null, polaroid: false };
    }
  }

  const nonCloserSlowMos = clipPlans.filter((c) => c.speedRamp === "slowmo" && c.narrativeRole !== "emotional-ending");
  nonCloserSlowMos.slice(1).forEach((clip) => {
    clip.speedRamp = "none";
  });

  if ((selectedStyle === "cinematic" || selectedStyle === "luxury") && n > 2) {
    const middleCandidates = clipPlans.filter((c) => c.role === "build");
    const hasBreathingMoment = middleCandidates.some((c) => !isStrongEffect(c));
    if (!hasBreathingMoment && middleCandidates.length > 0) {
      // Prefer the candidate closest to the highlight (right before/after
      // the dramatic beat is where a rest note reads most intentional).
      const breathingClip = [...middleCandidates].sort(
        (a, b) => Math.abs(a.index - highlightIndex) - Math.abs(b.index - highlightIndex)
      )[0];
      breathingClip.freezeFrame = null;
      breathingClip.speedRamp = "none";
    }
  }

  const intro: CreativeIntroPlan | null =
    gpsCardAllowed && timeline.gpxStats
      ? {
          type: "routeStatCard",
          title: timeline.routeLabel?.trim() || "Your Route",
          subtitle: [
            `${timeline.gpxStats.distanceKm.toFixed(1)} km`,
            timeline.gpxStats.durationLabel,
            timeline.gpxStats.elevationGainM > 0 ? `+${Math.round(timeline.gpxStats.elevationGainM)} m` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : null;

  return {
    style: selectedStyle,
    typography: profile.typography,
    colorTreatment: profile.colorTreatment,
    clips: clipPlans,
    intro,
    overlays: { letterbox, filmGrain, lightLeak, hud, bwReveal },
    proLockedEffects,
    pattern: { name: pattern.name, description: pattern.description },
  };
}

/**
 * UI-facing helper: what a style *does*, independent of any actual rendered
 * timeline — used by the style picker so users can see the difference
 * between styles before analyzing/rendering anything.
 */
export function getCreativeStyleSummary(style: ReelStyle) {
  return CREATIVE_STYLE_PROFILES[style].summary;
}
