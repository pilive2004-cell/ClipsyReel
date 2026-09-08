import { ReelStyle } from "@/types";

/**
 * Editing Patterns — original, reusable structural templates.
 *
 * These are NOT copies of any commercial editor's templates (CapCut, Canva,
 * Envato, Motion Array, Adobe Stock, etc.) and don't reference or resemble
 * any of their named products. Instead, each pattern captures a general,
 * commonly-understood structural idea from short-form video editing — "cold
 * open before the title", "build to a peak then land softly", "loop back to
 * the start" — described here in our own words and applied through our own
 * rendering pipeline (`video-engine.ts` + the Creative Style Engine).
 *
 * A pattern only decides STRUCTURE: where in the clip order the emotional
 * peak should land, what kind of opening/closing beat frames the story, and
 * how the pacing should feel across the montage. It does not by itself turn
 * on any Pro effect — `applyCreativeStyleEngine` still gates every actual
 * visual effect (freeze frames, overlays, etc.) behind the style profile and
 * the user's plan, same as before. The pattern just chooses *where* those
 * effects land, so two Reels in the same style don't always play out
 * identically.
 */

export type PatternOpener = "none" | "hookFreeze" | "routeCard" | "coldOpenFlash";
export type PatternHighlightPlacement = "early" | "middle" | "late";
export type PatternCloser = "polaroidMemory" | "bwFadeOut" | "freezeHold" | "loopOut" | "none";
export type PatternPacing = "accelerate" | "pulse" | "steady" | "decelerate";

export interface EditingPattern {
  id: string;
  name: string;
  /** Short, user-facing description of the structural idea — shown in the UI so the pattern feels intentional, not random. */
  description: string;
  opener: PatternOpener;
  highlightPlacement: PatternHighlightPlacement;
  closer: PatternCloser;
  pacing: PatternPacing;
  /** Which styles this structure suits. Most patterns fit several styles; a couple are tightly tied to one. */
  styles: ReelStyle[];
}

export const EDITING_PATTERNS: EditingPattern[] = [
  {
    id: "cold-open-hook",
    name: "Cold Open Hook",
    description: "Starts on the single strongest moment before anything else, then tells the rest of the story.",
    opener: "hookFreeze",
    highlightPlacement: "early",
    closer: "freezeHold",
    pacing: "accelerate",
    styles: ["viral", "sport"],
  },
  {
    id: "rising-action-arc",
    name: "Rising Action Arc",
    description: "Builds steadily clip by clip and lets the peak moment land right before the ending.",
    opener: "none",
    highlightPlacement: "late",
    closer: "freezeHold",
    pacing: "accelerate",
    styles: ["viral", "sport", "cinematic"],
  },
  {
    id: "postcard-sequence",
    name: "Postcard Sequence",
    description: "Opens with a route card, spreads its best moments evenly, and ends on a memory-card beat.",
    opener: "routeCard",
    highlightPlacement: "middle",
    closer: "polaroidMemory",
    pacing: "steady",
    styles: ["adventure", "travel"],
  },
  {
    id: "slow-burn-reveal",
    name: "Slow Burn Reveal",
    description: "Holds back, lets the middle breathe, then reveals its best moment right at the close.",
    opener: "none",
    highlightPlacement: "late",
    closer: "bwFadeOut",
    pacing: "decelerate",
    styles: ["cinematic", "luxury"],
  },
  {
    id: "highlight-reel-loop",
    name: "Highlight Reel Loop",
    description: "Leads with the peak moment, then loops the energy back around for a rewatchable ending.",
    opener: "coldOpenFlash",
    highlightPlacement: "early",
    closer: "loopOut",
    pacing: "pulse",
    styles: ["viral", "sport"],
  },
  {
    id: "punch-in-montage",
    name: "Punch-In Montage",
    description: "Keeps every clip short and punchy with the peak sitting right in the middle of the run.",
    opener: "none",
    highlightPlacement: "middle",
    closer: "none",
    pacing: "pulse",
    styles: ["viral", "sport", "adventure"],
  },
  {
    id: "quiet-open-elegant-close",
    name: "Quiet Open, Elegant Close",
    description: "Understated start, minimal build, and a refined closing beat rather than a big peak.",
    opener: "none",
    highlightPlacement: "middle",
    closer: "bwFadeOut",
    pacing: "steady",
    styles: ["luxury", "cinematic"],
  },
];

const STORAGE_KEY = "clipsyreel:lastPatternByStyle";

function readLastPatternMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeLastPattern(style: ReelStyle, patternId: string) {
  if (typeof window === "undefined") return;
  try {
    const map = readLastPatternMap();
    map[style] = patternId;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort only — losing pattern memory just means occasional repeats, not a functional problem.
  }
}

/**
 * Picks an Editing Pattern for this style, remembering the last one used (per
 * style, persisted in localStorage) so the *same* pattern doesn't play twice
 * in a row — every regeneration in the same style should feel structurally
 * different where possible.
 */
export function selectEditingPattern(style: ReelStyle): EditingPattern {
  const candidates = EDITING_PATTERNS.filter((p) => p.styles.includes(style));
  const pool = candidates.length > 0 ? candidates : EDITING_PATTERNS;

  const lastId = readLastPatternMap()[style];
  const withoutLast = pool.length > 1 ? pool.filter((p) => p.id !== lastId) : pool;
  const finalPool = withoutLast.length > 0 ? withoutLast : pool;

  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];
  writeLastPattern(style, chosen.id);
  return chosen;
}
