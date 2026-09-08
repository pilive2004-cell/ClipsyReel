/**
 * EditingIntelligenceRefiner — bridges this standalone `editing-intelligence`
 * module (scores, story phases, rule engine) with the REAL production
 * rendering pipeline (`src/lib/video-engine.ts`), the same way
 * `viral-patterns/AutomaticPatternSelector.ts` bridges the pattern library.
 *
 * This runs automatically on every real render, silently — there is no
 * user-facing UI for it. It takes the segment order `planReelSegments()`
 * already picked (best-moment selection, fair-share source capping, hook
 * cap, near-duplicate/back-to-back removal are all untouched and stay owned
 * by `video-engine.ts`) and applies a background rule-engine QA pass on top:
 *
 * - Progressive intensity: shapes the pre-climax run so energy trends
 *   upward instead of feeling randomly ordered.
 * - "Always finish with the strongest scene": guarantees the final clip is
 *   the highest-quality moment available.
 * - No consecutive similar clips: an extra safety net alongside
 *   `avoidBackToBackSameSource`.
 * - Cross-render memory: uses `localStorage` to remember recent montage
 *   structures so re-rendering the same footage doesn't always produce an
 *   identical edit.
 *
 * Design constraints (deliberately conservative, to avoid destabilizing the
 * working render pipeline):
 * - Never touches the opening hook slots — the first `hookCount` segments
 *   (already capped short in `planReelSegments`) are passed through
 *   untouched so the 3-second hook is never displaced.
 * - Only ever REORDERS segments — never invents, drops, changes length, or
 *   sets playback speed/slow-motion (that stays owned entirely by
 *   `creative-style-engine.ts`, so there is no double-application of speed
 *   ramps or freeze frames).
 * - Any failure here must never block a render — falls back to the
 *   untouched input order, exactly like `AutomaticPatternSelector`.
 */
import type { BestMoment, EmotionalStoryRole } from "@/types";
import { computeClipScores } from "./ScoreEngine";
import { buildTimelineClip, recalculateTimeline } from "./timeline-helpers";
import { RuleEngine } from "./RuleEngine";
import { createNoConsecutiveSimilarClipsRule, areSimilar, type SimilarityClip } from "./rules/noConsecutiveSimilarClips";
import { createProgressiveIntensityRule } from "./rules/progressiveIntensity";
import { createEndOnStrongestSceneRule } from "./rules/endOnStrongestScene";
import { createAvoidRepetitivePatternsRule } from "./rules/avoidRepetitivePatterns";
import type { EditingClipCandidate, EditingPatternMemoryStorage, EditingTimeline, RuleContext, StoryPhase } from "./types";

type PinnedRole = Exclude<EmotionalStoryRole, "thumbnail-moment">;

const ROLE_TO_PHASE: Record<PinnedRole, StoryPhase> = {
  "opening-hook": "hook",
  context: "introduction",
  journey: "build_up",
  discovery: "action",
  "peak-moment": "climax",
  "emotional-ending": "ending",
};

/** Minimal shape this refiner needs from `video-engine.ts`'s internal `Segment` — kept generic so this module never imports from `video-engine.ts` (one-directional dependency). */
export interface RefinableSegment {
  sourceIndex: number;
  start: number;
  length: number;
  confidence: number;
  motion?: number;
  clarity?: number;
  narrativeRole?: PinnedRole | null;
}

export interface EditingIntelligenceRefinement<T> {
  segments: T[];
  /** Human-readable line for the render's "applied effects" summary, or "" when the pass made no changes. */
  summaryLine: string;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Adapts a `RefinableSegment` to the minimal shape `areSimilar` needs — used for the hook/body seam fixup below. */
function toSimilarityClip(segment: RefinableSegment): SimilarityClip {
  return { sourceIndex: segment.sourceIndex, sourceStartSeconds: segment.start, durationSeconds: segment.length };
}

/** Reconstructs a minimal `BestMoment`-shaped object from a segment's own confidence/motion/clarity so `computeClipScores` (which reuses `BestMoment.scoreBreakdown`) can run without re-deriving pixel analysis. */
function segmentToShimMoment(segment: RefinableSegment, id: string): BestMoment {
  const confidenceUnit = clamp01(segment.confidence / 100);
  return {
    id,
    timestampLabel: "",
    startSeconds: segment.start,
    endSeconds: segment.start + segment.length,
    confidence: segment.confidence,
    reason: "",
    sourceIndex: segment.sourceIndex,
    scoreBreakdown: {
      retention: confidenceUnit,
      motion: segment.motion ?? confidenceUnit,
      visualImpact: confidenceUnit,
      clarity: segment.clarity ?? confidenceUnit,
      gpxContext: 0.5,
      emotion: confidenceUnit,
    },
  };
}

function localStorageBackedMemory(): EditingPatternMemoryStorage {
  return {
    getItem: (key) => (typeof window !== "undefined" ? window.localStorage.getItem(key) : null),
    setItem: (key, value) => {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    },
  };
}

/**
 * Runs the background rule-engine QA pass described above. Always safe to
 * call — returns the untouched input (with an empty `summaryLine`) if the
 * body is too short to meaningfully reorder or if anything goes wrong.
 */
export function refineSegmentOrderWithEditingIntelligence<T extends RefinableSegment>(
  segments: T[],
  options: { hookCount?: number; storageKey?: string } = {}
): EditingIntelligenceRefinement<T> {
  const hookCount = Math.max(0, Math.min(options.hookCount ?? 2, segments.length));
  try {
    const hookSegments = segments.slice(0, hookCount);
    const bodySegments = segments.slice(hookCount);
    // Too few clips in the body for reordering (progressive-intensity /
    // end-on-strongest-scene) to mean anything — leave untouched.
    if (bodySegments.length < 3) {
      return { segments, summaryLine: "" };
    }

    const candidates: EditingClipCandidate[] = bodySegments.map((segment, index) => {
      const momentId = `body-${index}`;
      return {
        momentId,
        scores: computeClipScores(segmentToShimMoment(segment, momentId)),
        sourceIndex: segment.sourceIndex,
        sourceStartSeconds: segment.start,
        durationSeconds: segment.length,
        sequenceIndex: index,
      };
    });

    const initialTimeline: EditingTimeline = recalculateTimeline({
      clips: candidates.map((candidate, index) =>
        buildTimelineClip({
          candidate,
          phase: bodySegments[index].narrativeRole ? ROLE_TO_PHASE[bodySegments[index].narrativeRole as PinnedRole] : "build_up",
          durationSeconds: candidate.durationSeconds ?? 2,
        })
      ),
      instructions: [],
      markers: [],
      totalDurationSeconds: 0,
    });

    const clipCatalog: Record<string, EditingClipCandidate> = Object.fromEntries(candidates.map((c) => [c.momentId, c]));
    const initialContext: RuleContext = { timeline: initialTimeline, clipCatalog, notes: [] };

    // `createNoConsecutiveSimilarClipsRule` is registered LAST on purpose —
    // see its own doc comment: every rule before it reorders clips by
    // score/energy/history with zero adjacency awareness, so it must run
    // after all of them to be an actual guarantee on the final output
    // rather than a check the later rules can silently undo.
    const engine = new RuleEngine()
      .register(createProgressiveIntensityRule())
      .register(createEndOnStrongestSceneRule())
      .register(createAvoidRepetitivePatternsRule(localStorageBackedMemory(), { storageKey: options.storageKey }))
      .register(createNoConsecutiveSimilarClipsRule());

    const result = engine.run(initialContext);
    if (result.notes.length === 0) return { segments, summaryLine: "" };

    const bodyByMomentId = new Map(bodySegments.map((segment, index) => [`body-${index}`, segment]));
    const reorderedBody = result.timeline.clips.map((clip) => bodyByMomentId.get(clip.momentId)).filter((segment): segment is T => segment !== undefined);

    // Safety net: if the rule engine's output doesn't map cleanly back onto
    // every original segment (should never happen), keep the original order
    // rather than risk silently dropping a clip from the montage.
    if (reorderedBody.length !== bodySegments.length) {
      return { segments, summaryLine: "" };
    }

    // Hook/body seam fixup: the rule engine above only ever sees
    // `bodySegments`, so it has no idea what the pinned hook segments look
    // like — it can (and did) happily reorder the body so its new first
    // clip ends up a near-duplicate of the last hook clip, recreating
    // exactly the "same shot twice in a row" problem right at the seam.
    // `avoidBackToBackSameSource`/`removeNearDuplicateSegments` already
    // guaranteed this wasn't the case in the ORIGINAL order, so only look
    // for a fix here — this never introduces a new violation, only removes
    // one at the boundary.
    const lastHook = hookSegments[hookSegments.length - 1];
    if (lastHook && reorderedBody.length > 1 && areSimilar(toSimilarityClip(lastHook), toSimilarityClip(reorderedBody[0]))) {
      const swapIndex = reorderedBody.findIndex(
        (candidate, i) => i > 0 && !areSimilar(toSimilarityClip(lastHook), toSimilarityClip(candidate))
      );
      if (swapIndex !== -1) {
        [reorderedBody[0], reorderedBody[swapIndex]] = [reorderedBody[swapIndex], reorderedBody[0]];
      }
    }

    return {
      segments: [...hookSegments, ...reorderedBody],
      summaryLine: "AI-refined pacing & structure",
    };
  } catch {
    // Pure enhancement — any failure here must never block or alter the
    // render, so we fall back to the untouched input order.
    return { segments, summaryLine: "" };
  }
}
