import type { Rule } from "../types";
import { recalculateTimeline } from "../timeline-helpers";

export const DEFAULT_SIMILAR_CLIP_WINDOW_MULTIPLIER = 1.2;

export type SimilarityClip = { sourceIndex: number | null; sourceStartSeconds: number | null; durationSeconds: number };

/** Exported so callers outside this rule (e.g. `EditingIntelligenceRefiner`'s hook/body seam fixup) can reuse the exact same "is this a near-duplicate?" definition instead of re-implementing it slightly differently. */
export function areSimilar(a: SimilarityClip, b: SimilarityClip, windowMultiplier: number = DEFAULT_SIMILAR_CLIP_WINDOW_MULTIPLIER): boolean {
  if (a.sourceIndex === null || b.sourceIndex === null) return false;
  if (a.sourceIndex !== b.sourceIndex) return false;
  if (a.sourceStartSeconds === null || b.sourceStartSeconds === null) return true;
  const startGap = Math.abs(a.sourceStartSeconds - b.sourceStartSeconds);
  return startGap < Math.min(a.durationSeconds, b.durationSeconds) * windowMultiplier;
}

/** True if swapping the clips currently at `i` and `j` (i < j) would leave any of the four touched neighbor-pairs similar. Used to make sure fixing one adjacency doesn't just relocate the problem. */
function swapWouldStillHaveAdjacentDuplicate<T extends SimilarityClip>(clips: T[], i: number, j: number, windowMultiplier: number): boolean {
  const a = clips[j]; // what would land at i
  const b = clips[i]; // what would land at j
  if (i > 0 && areSimilar(clips[i - 1], a, windowMultiplier)) return true;
  if (i + 1 !== j && i + 1 < clips.length && areSimilar(a, clips[i + 1], windowMultiplier)) return true;
  if (j - 1 !== i && j - 1 >= 0 && areSimilar(clips[j - 1], b, windowMultiplier)) return true;
  if (j + 1 < clips.length && areSimilar(b, clips[j + 1], windowMultiplier)) return true;
  return false;
}

/**
 * Prevents adjacent clips from feeling like accidental duplicates.
 *
 * This mirrors the production pipeline's conservative "same source + nearby
 * time = probably too similar" rule, but exposes it as a reusable pure rule.
 *
 * IMPORTANT: this must run as the FINAL rule in the chain (see
 * `EditingIntelligenceRefiner.ts`), not just the first one. Every other rule
 * here (`progressiveIntensity`, `endOnStrongestScene`,
 * `avoidRepetitivePatterns`) reorders clips purely by score/energy/history
 * with zero awareness of adjacency, so any one of them can — and in
 * practice regularly did — put two near-identical clips right back next to
 * each other after this rule had already fixed the original order. Running
 * it last makes it the actual final safety net over the real output instead
 * of a check that later passes can silently undo.
 */
export function createNoConsecutiveSimilarClipsRule(windowMultiplier = DEFAULT_SIMILAR_CLIP_WINDOW_MULTIPLIER): Rule {
  return {
    id: "no-consecutive-similar-clips",
    description: "Avoids placing near-duplicate clips back to back.",
    apply(context) {
      const clips = [...context.timeline.clips];
      let changed = false;
      for (let index = 1; index < clips.length; index++) {
        if (!areSimilar(clips[index - 1], clips[index], windowMultiplier)) continue;

        // Prefer a candidate further ahead in the run — but verify the swap
        // doesn't just relocate the duplicate onto one of the four touched
        // neighbor-pairs.
        let candidateIndex = -1;
        for (let j = index + 1; j < clips.length; j++) {
          if (!areSimilar(clips[index - 1], clips[j], windowMultiplier) && !swapWouldStillHaveAdjacentDuplicate(clips, index, j, windowMultiplier)) {
            candidateIndex = j;
            break;
          }
        }
        // Fallback: if nothing later in the run works (e.g. the clash is at
        // the very end of the list, where a forward-only search has no
        // candidates left to try), also look backward — this is what makes
        // the rule effective even when run after `endOnStrongestScene` has
        // just moved something into the final slot.
        if (candidateIndex === -1) {
          for (let j = index - 2; j >= 0; j--) {
            if (!areSimilar(clips[index - 1], clips[j], windowMultiplier) && !swapWouldStillHaveAdjacentDuplicate(clips, j, index, windowMultiplier)) {
              candidateIndex = j;
              break;
            }
          }
        }
        if (candidateIndex === -1) continue;
        const lo = Math.min(index, candidateIndex);
        const hi = Math.max(index, candidateIndex);
        [clips[lo], clips[hi]] = [clips[hi], clips[lo]];
        changed = true;
      }
      if (!changed) return context;
      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips }),
        notes: [...context.notes, "Rule applied: no consecutive similar clips."],
      };
    },
  };
}

export const noConsecutiveSimilarClipsRule = createNoConsecutiveSimilarClipsRule();
