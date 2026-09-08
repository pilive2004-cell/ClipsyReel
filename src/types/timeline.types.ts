/**
 * Lightweight timeline vocabulary shared by the transition system. Kept
 * intentionally small — this is not a full render timeline model, just the
 * shot-level concepts `TransitionContext` needs to reason about.
 */

/** What kind of shot is currently on screen — used to match a transition's `bestUsedFor` against the actual footage. */
export type SceneType = "landscape" | "action" | "portrait" | "map" | "detail" | "establishing" | "closeUp";

/** Coarse, three-bucket signal strength used throughout `TransitionContext` (speed, gradient, drama, etc.) instead of raw numbers — keeps the selection rules readable and stable across very different GPX datasets. */
export type SignalLevel = "low" | "medium" | "high";

/** One planned shot in a sequence — the minimal shape the transition system needs to reason about a cut between shot `n` and shot `n+1`. */
export interface TimelineShot {
  index: number;
  sceneType: SceneType;
  durationSeconds: number;
}
