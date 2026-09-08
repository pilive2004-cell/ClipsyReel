import { StylePreset, VisualStyleId } from "@/types/style.types";
import { STYLE_TRANSITION_RULES } from "@/transitions/styleTransitionRules";
import { TRANSITION_DEFINITIONS } from "@/transitions/transitionDefinitions";
import { TransitionContext, TransitionDecision, TransitionDefinition, TransitionId } from "@/transitions/transition.types";
import { transitionFamilyOf } from "@/transitions/transitionFamilies";
import { clamp, isAffordable, stableTieBreak } from "@/transitions/transitionUtils";

/** Large enough to always push an immediate repeat out of contention, without being an outright hard exclusion — if a style only has ONE eligible transition left, repeating it is still better than crashing. */
const REPEAT_PENALTY = 1000;
/** Strong penalty when the top candidate shares its *family* with the immediately-previous transition (e.g. `whipPan` right after `motionBlurSwipe` — different ids, same "directional wipe" family) — this is what stops a style from reading as "always the same swipe/zoom" even while technically rotating ids. */
const SAME_FAMILY_AS_LAST_PENALTY = 30;
/** Moderate penalty once a family has already appeared >= `FAMILY_OVERUSE_THRESHOLD` times within the recent history window — prevents a family from dominating the edit even when it's never picked twice *consecutively*. */
const FAMILY_OVERUSE_PENALTY = 18;
const FAMILY_OVERUSE_THRESHOLD = 2;
/** Extra scoring bonus for a style's `corePreferredTransitions` (the 5 explicitly "must prefer" signatures) over its broader `preferredTransitions` pool. */
const CORE_PREFERRED_BONUS = 10;
/** Scoring bonus for being anywhere in the broader `preferredTransitions` pool. */
const PREFERRED_BONUS = 4;

/**
 * Per explicit user request, the whole edit currently uses ONE single
 * transition effect everywhere — a clean cross fade — instead of rotating
 * through the style's transition palette. This is a deliberate, temporary
 * simplification favoring readability/consistency over variety; flip this
 * back to `false` (or remove it) to restore the full per-style scored
 * transition selection below.
 */
const SINGLE_TRANSITION_MODE = true;
const FORCED_TRANSITION_ID: TransitionId = "crossFade";

/**
 * TransitionSelector — the "editor with a visual intention" at the center of
 * this system. It never picks randomly: every decision is a scored,
 * explainable choice that respects (in this order):
 *
 * 1. Hard eligibility — style compatibility, forbidden list, performance budget.
 * 2. The style's stated creative preference (`corePreferredTransitions` > `preferredTransitions` > `preferredTransitionCategories`).
 * 3. The actual GPX/scene/music context of this specific moment (speed, gradient, turn sharpness, terrain drama, beat strength, scenic/action flags).
 * 4. Variety — avoiding the same transition firing twice in a row.
 *
 * `select()` is a pure function of its `context` argument — no hidden
 * state — so the same context always produces the same decision.
 */
export class TransitionSelector {
  constructor(
    private readonly rules: Record<VisualStyleId, StylePreset> = STYLE_TRANSITION_RULES,
    private readonly definitions: Record<TransitionId, TransitionDefinition> = TRANSITION_DEFINITIONS
  ) {}

  select(context: TransitionContext): TransitionDecision {
    const rule = this.rules[context.selectedStyle];

    if (SINGLE_TRANSITION_MODE) {
      const forced = this.definitions[FORCED_TRANSITION_ID];
      if (
        forced &&
        forced.compatibleStyles.includes(context.selectedStyle) &&
        !rule.forbiddenTransitions.includes(forced.id) &&
        (!context.performanceProfile || isAffordable(forced.performanceCost, context.performanceProfile))
      ) {
        return this.buildDecision(forced, context, rule);
      }
      // Falls through to the normal scored selection only if the forced
      // transition is somehow unavailable for this style/context.
    }

    let candidates = this.eligibleCandidates(rule, context);
    if (candidates.length === 0) {
      // Should never happen with a well-formed rule set (every style has >=1 affordable, non-forbidden transition) — but a render pipeline must never throw over a creative decision, so fall back to the style's own core list.
      candidates = rule.corePreferredTransitions.map((id) => this.definitions[id]).filter((def): def is TransitionDefinition => !!def);
    }

    const scored = candidates.map((def) => ({ def, score: this.score(def, context, rule) }));
    scored.sort((a, b) => b.score - a.score);

    const topScore = scored[0].score;
    const tiedForTop = scored.filter((s) => Math.abs(s.score - topScore) < 0.001).map((s) => s.def);
    const chosen = tiedForTop.length === 1 ? tiedForTop[0] : stableTieBreak(tiedForTop, this.deterministicIndex(context));

    return this.buildDecision(chosen, context, rule);
  }

  /** Hard filters — never violated, regardless of score. */
  private eligibleCandidates(rule: StylePreset, context: TransitionContext): TransitionDefinition[] {
    return Object.values(this.definitions).filter((def) => {
      if (!def.compatibleStyles.includes(context.selectedStyle)) return false; // Rule: never select a transition outside this style's own palette.
      if (rule.forbiddenTransitions.includes(def.id)) return false; // Rule: never select a forbidden transition.
      if (context.performanceProfile && !isAffordable(def.performanceCost, context.performanceProfile)) return false; // Rule: respect the render performance budget, when supplied.
      // Rule: `textPopReveal` (and any future text-driven transition) may
      // only be chosen when a real text payload will actually be
      // composited onto this cut — otherwise it's a transition that
      // "reveals" nothing, and picking it anyway is exactly how a style
      // could silently look like it wants text that was never configured.
      if (def.id === "textPopReveal" && !context.hasTextOverlay) return false;
      return true;
    });
  }

  /** Soft scoring — this is where style personality actually gets expressed. */
  private score(def: TransitionDefinition, context: TransitionContext, rule: StylePreset): number {
    let score = 0;

    if (rule.corePreferredTransitions.includes(def.id)) score += CORE_PREFERRED_BONUS;
    else if (rule.preferredTransitions.includes(def.id)) score += PREFERRED_BONUS;

    // Being tagged with one of this style's preferred affinity categories (terrain/beat/flow/action/story/subtle) is always worth something.
    if (def.affinities.some((affinity) => rule.preferredTransitionCategories.includes(affinity))) score += 3;

    // Rule: respect style intensity — penalize transitions whose own intensity drifts far from the style's ceiling.
    score -= Math.abs(def.intensity - rule.transitionIntensity) * 0.4;

    // Rule: respect shot duration — favor transitions whose duration range roughly overlaps the style's mandated transition-duration range.
    const overlapsDurationRange = def.durationRange[0] <= rule.transitionDurationRange[1] && def.durationRange[1] >= rule.transitionDurationRange[0];
    score += overlapsDurationRange ? 2 : -3;

    // Style-specific contextual reaction — this is what makes the SAME context produce a different answer per style.
    score += this.contextualBonus(def, context, rule);

    // Rule: avoid repeating the same transition too often. Penalize any
    // transition still within the recent history window (heaviest for the
    // immediately-previous one, decaying for older ones) — a single
    // immediate-previous check let a style's top-2 scoring core transitions
    // simply oscillate back and forth forever, which reads on screen as
    // "there's only one transition". Falls back to the plain previous-id
    // check when no history array was supplied.
    const history = context.recentTransitionIds ?? (context.previousTransitionId ? [context.previousTransitionId] : []);
    const recentIndex = history.indexOf(def.id);
    if (recentIndex !== -1) score -= REPEAT_PENALTY / (recentIndex + 1);

    // Rule: family-level variety. Two different `TransitionId`s can still
    // read as the same effect (e.g. `whipPan` and `motionBlurSwipe` are both
    // directional wipes) — tracking history at the *family* level is what
    // stops a style from feeling like "it's always the same swipe/zoom"
    // even while it's technically rotating ids never repeating literally.
    const familyHistory = context.recentTransitionFamilies ?? history.map((id) => transitionFamilyOf(id));
    const defFamily = transitionFamilyOf(def.id);
    if (familyHistory.length > 0 && familyHistory[0] === defFamily) score -= SAME_FAMILY_AS_LAST_PENALTY;
    const familyUseCount = familyHistory.filter((f) => f === defFamily).length;
    if (familyUseCount >= FAMILY_OVERUSE_THRESHOLD) score -= FAMILY_OVERUSE_PENALTY;

    return score;
  }

  /**
   * Each style reacts to the *same* context signals completely differently —
   * this is the single place that encodes "why Adventure ≠ Viral ≠ Travel ≠
   * Sport ≠ Cinematic ≠ Luxury" for a given moment, weighted by each style's
   * own priority fields (`beatSyncPriority`, `terrainUsagePriority`, …).
   */
  private contextualBonus(def: TransitionDefinition, context: TransitionContext, rule: StylePreset): number {
    let bonus = 0;

    // Terrain (Adventure's defining reactive trait).
    if (def.requiresTerrainContext) {
      bonus += context.terrainDrama * rule.terrainUsagePriority;
      bonus += clamp(Math.abs(context.elevationChange) / 100, 0, 1) * rule.terrainUsagePriority * 0.5;
    }

    // Beat sync (Viral's defining reactive trait, Sport secondarily).
    if (def.requiresBeatSync) {
      bonus += context.musicBeatStrength * rule.beatSyncPriority;
    }

    // Action events — speed and turn sharpness (Sport's defining reactive trait).
    if (def.affinities.includes("action")) {
      const speedSignal = clamp(context.speedKmh / 100, 0, 1);
      bonus += speedSignal * rule.actionPriority * 0.6;
      bonus += context.turnSharpness * rule.actionPriority * 0.6;
      if (context.isActionMoment) bonus += rule.actionPriority * 0.4;
    }
    if (context.turnSharpness > 0.6 && (def.id === "cornerAttack" || def.id === "trackingSnap")) bonus += rule.actionPriority * 0.5;
    if (context.speedKmh > 60 && (def.id === "velocityBlur" || def.id === "accelerationRamp")) bonus += rule.actionPriority * 0.4;

    // Flow / continuity (Travel's defining reactive trait).
    if (def.affinities.includes("flow")) {
      bonus += rule.smoothnessPriority * 0.5;
      if (context.isScenicMoment) bonus += rule.smoothnessPriority * 0.3;
    }

    // Story / atmosphere (Cinematic's defining reactive trait).
    if (def.affinities.includes("story")) {
      bonus += rule.elegancePriority * 0.4;
      if (context.isScenicMoment) bonus += rule.elegancePriority * 0.3;
      if (context.terrainDrama > 0.6 && def.id === "epicReveal") bonus += rule.elegancePriority * 0.5;
    }

    // Subtlety / refinement (Luxury's defining reactive trait) — the calmer the moment, the more it fits.
    if (def.affinities.includes("subtle")) {
      bonus += rule.elegancePriority * 0.5;
      const calmness = 1 - clamp(context.speedKmh / 100, 0, 1);
      bonus += calmness * rule.elegancePriority * 0.3;
    }

    return bonus;
  }

  /** Deterministic tie-break seed derived purely from context — no hidden shot counter needed since `select()` must stay a pure function of `context`. */
  private deterministicIndex(context: TransitionContext): number {
    const numeric = Math.round(
      (context.speedKmh + context.gradientPercent + context.elevationChange + context.turnSharpness * 100 + context.terrainDrama * 100 + context.musicBeatStrength * 100) * 10
    );
    return Math.abs(numeric);
  }

  private buildDecision(def: TransitionDefinition, context: TransitionContext, rule: StylePreset): TransitionDecision {
    const duration = this.resolveDuration(def, rule, context);
    const visualEffectIntensity = clamp(Math.round(def.intensity * (rule.transitionIntensity / 10) * 10) / 10, 0, 10);
    const cameraMode = context.cameraMode ?? rule.preferredCameraModes[0];

    return {
      transitionId: def.id,
      transitionFamily: transitionFamilyOf(def.id),
      duration,
      easing: def.easing,
      reason: this.explain(def, context, rule),
      cameraInfluence: `${rule.displayName}'s ${cameraMode} camera language (energy ${rule.cameraEnergy}/10) carries the motion into "${def.displayName}".`,
      visualEffectIntensity,
    };
  }

  /**
   * Resolves the final on-screen transition duration, always inside the
   * style's mandated `transitionDurationRange` (the explicit "duration
   * rules" — e.g. Viral 0.15-0.5s, Luxury 2.0-4.0s) — the transition's own
   * `durationRange` only narrows *where* inside that window it lands.
   */
  private resolveDuration(def: TransitionDefinition, rule: StylePreset, context: TransitionContext): number {
    const [styleMin, styleMax] = rule.transitionDurationRange;
    const [defMin, defMax] = def.durationRange;
    const overlapMin = Math.max(styleMin, defMin);
    const overlapMax = Math.min(styleMax, defMax);
    const [lo, hi] = overlapMin <= overlapMax ? [overlapMin, overlapMax] : [styleMin, styleMax];

    // Higher real-world speed compresses duration toward the low end, regardless of style.
    const speedBias = clamp(context.speedKmh / 120, 0, 1);
    const bias = clamp(0.5 - speedBias * 0.4, 0, 1);
    const raw = lo + (hi - lo) * bias;
    return clamp(Math.round(raw * 100) / 100, styleMin, styleMax);
  }

  /** Human-readable justification — the whole point of scoring instead of randomizing is that every pick can be explained. */
  private explain(def: TransitionDefinition, context: TransitionContext, rule: StylePreset): string {
    const signals: string[] = [];
    if (context.terrainDrama > 0.6 && def.requiresTerrainContext) signals.push("high terrain drama");
    if (context.musicBeatStrength > 0.6 && def.requiresBeatSync) signals.push("strong music beat");
    if (context.turnSharpness > 0.6) signals.push("sharp turn");
    if (context.speedKmh > 60) signals.push("high speed");
    if (context.isScenicMoment) signals.push("scenic moment");
    if (context.isActionMoment) signals.push("action moment");
    const signalText = signals.length > 0 ? ` (${signals.join(" + ")})` : "";
    return `${rule.displayName} style prefers "${def.displayName}"${signalText} — ${def.description}`;
  }
}

/** Shared default instance — stateless, so a single instance is safe to reuse anywhere. */
export const transitionSelector = new TransitionSelector();

/**
 * Public decision API.
 *
 * A pure function of `context` — the caller is responsible for supplying
 * `previousTransitionId` from its own last decision if it wants repeats
 * avoided across a sequence (see `TransitionEngine` for a small stateful
 * convenience wrapper that does this automatically).
 */
export function selectTransition(context: TransitionContext, selector: TransitionSelector = transitionSelector): TransitionDecision {
  return selector.select(context);
}
