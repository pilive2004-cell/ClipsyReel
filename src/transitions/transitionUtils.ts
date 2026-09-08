import { PerformanceCost } from "@/transitions/transition.types";

/** Clamps a number into [min, max] — used everywhere duration/intensity math could otherwise drift out of range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Maps a 0-10 style intensity ceiling + a candidate transition's own intensity into a final on-screen intensity, so a low-intensity style never accidentally renders a maxed-out effect even if the transition itself supports it. */
export function scaleIntensityToStyleCeiling(transitionIntensity: number, styleIntensityCeiling: number): number {
  const ratio = clamp(styleIntensityCeiling / 10, 0, 1);
  return clamp(Math.round(transitionIntensity * ratio * 10) / 10, 0, 10);
}

/** Picks a duration inside `[min, max]` biased toward the low end for high-energy styles and the high end for slow/deliberate styles, via a 0-1 `bias` (0 = shortest, 1 = longest). */
export function biasedDuration(range: [number, number], bias: number): number {
  const [min, max] = range;
  const clampedBias = clamp(bias, 0, 1);
  return Math.round((min + (max - min) * clampedBias) * 100) / 100;
}

const PERFORMANCE_RANK: Record<PerformanceCost, number> = { low: 0, medium: 1, high: 2 };

/** True when `cost` is affordable under `profile` (a "high" performance profile — i.e. a capable device/renderer — can afford anything; a "low" profile can only afford "low" cost transitions). */
export function isAffordable(cost: PerformanceCost, profile: PerformanceCost): boolean {
  return PERFORMANCE_RANK[cost] <= PERFORMANCE_RANK[profile];
}

/** Simple seeded-free tie-breaker: given equally-scored candidates, deterministically prefer the one whose id sorts first for a given shotIndex, so repeated renders of the same footage don't reorder non-deterministically while still varying choice across shots. */
export function stableTieBreak<T extends { id: string }>(candidates: T[], shotIndex: number): T {
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[shotIndex % sorted.length];
}
