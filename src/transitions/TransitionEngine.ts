import { TransitionSelector, transitionSelector, selectTransition } from "@/transitions/TransitionSelector";
import { TransitionContext, TransitionDecision } from "@/transitions/transition.types";
import { VisualStyleId } from "@/types/style.types";

export { selectTransition };

/**
 * TransitionEngine — a tiny stateful convenience wrapper for walking a real
 * shot sequence, where each decision needs to know the *previous* one to
 * respect the "avoid repeating the same transition too often" rule without
 * every caller having to thread `previousTransitionId` through by hand.
 *
 * `TransitionSelector.select()` / `selectTransition()` themselves stay pure
 * functions of `context` — this class just remembers the last decision.
 */
export class TransitionEngine {
  private previousTransitionId: TransitionContext["previousTransitionId"] = null;
  /** Short rolling history (most recent first) — see `TransitionContext.recentTransitionIds` doc comment for why this beats a single previous-id check. Sized at 5 so family-overuse tracking ("no family more than 2 times in the last 5 transitions") has a full window to look at. */
  private recentTransitionIds: TransitionContext["recentTransitionIds"] = [];
  private static readonly HISTORY_SIZE = 5;

  constructor(private readonly selector: TransitionSelector = transitionSelector) {}

  /** Decide the next transition, automatically carrying over `previousTransitionId`/`recentTransitionIds` from prior calls on this instance. */
  next(context: Omit<TransitionContext, "previousTransitionId" | "recentTransitionIds">): TransitionDecision {
    const decision = this.selector.select({
      ...context,
      previousTransitionId: this.previousTransitionId,
      recentTransitionIds: this.recentTransitionIds,
    });
    this.previousTransitionId = decision.transitionId;
    this.recentTransitionIds = [decision.transitionId, ...(this.recentTransitionIds ?? [])].slice(0, TransitionEngine.HISTORY_SIZE);
    return decision;
  }

  /** Reset state — e.g. when starting a brand new Reel. */
  reset(): void {
    this.previousTransitionId = null;
    this.recentTransitionIds = [];
  }
}

/**
 * Example usage (spec item 6): the SAME GPX moment — high speed, medium
 * gradient, sharp turn, high terrain drama, strong music beat — fed through
 * all 6 styles. Expected (and verified by `__tests__/exampleUsage.test.ts`):
 *
 *   Adventure  -> mountainReveal or terrainMask
 *   Viral      -> zoomSmash or beatCut
 *   Travel     -> directionMatch or horizonMatch
 *   Sport      -> cornerAttack or impactCut
 *   Cinematic  -> epicReveal or orbitBlend
 *   Luxury     -> silkFade or lightSweep
 */
export function demonstrateSameMomentAcrossStyles(): Record<VisualStyleId, TransitionDecision> {
  const sharedMoment = {
    speedKmh: 85,
    gradientPercent: 6,
    elevationChange: 120,
    turnSharpness: 0.85,
    terrainDrama: 0.9,
    musicBeatStrength: 0.85,
    isScenicMoment: true,
    isActionMoment: true,
    previousTransitionId: null,
    performanceProfile: "high",
  } as const;

  const styles: { style: VisualStyleId; cameraMode: TransitionContext["cameraMode"] }[] = [
    { style: "adventure", cameraMode: "droneFlyover" },
    { style: "viral", cameraMode: "fastPushIn" },
    { style: "travel", cameraMode: "smoothDronePan" },
    { style: "sport", cameraMode: "lowChase" },
    { style: "cinematic", cameraMode: "stableCrane" },
    { style: "luxury", cameraMode: "floatingCamera" },
  ];

  return styles.reduce((acc, { style, cameraMode }) => {
    acc[style] = selectTransition({ ...sharedMoment, selectedStyle: style, cameraMode });
    return acc;
  }, {} as Record<VisualStyleId, TransitionDecision>);
}

