/**
 * PatternMixer — combines/varies patterns so that no two generated montages
 * feel identical, while enforcing the product's editing-quality guardrails
 * (clear climax, controlled transition count, clarity in the first 3s, etc.).
 */
import { PatternLibrary, defaultPatternLibrary } from "./PatternLibrary";
import { buildEditingSignature, MontageRecipeGenerator } from "./MontageRecipeGenerator";
import {
  MontagePattern,
  MontageRecipe,
  MontageRecipeInput,
  PatternMixOptions,
  PatternMixResult,
  TransitionType,
} from "./types";

/** Transitions considered "highly visible" — flashy enough that overusing
 * them in a short video breaks the premium feel. */
const HIGH_VISIBILITY_TRANSITIONS: TransitionType[] = [
  "whip_pan",
  "flash_cut",
  "speed_ramp",
  "zoom_transition",
  "drone_like_reveal",
  "pov_transition",
  "map_transition",
];

const SUBTLE_FALLBACKS: TransitionType[] = ["direct_cut", "crossfade", "hard_cut_on_beat"];

/** Simple deterministic PRNG so mixing is reproducible when a seed is given, and
 * still varies naturally (based on call count / time) when no seed is given. */
function makeRng(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export class PatternMixer {
  constructor(
    private library: PatternLibrary = defaultPatternLibrary,
    private generator: MontageRecipeGenerator = new MontageRecipeGenerator(defaultPatternLibrary)
  ) {}

  mix(input: MontageRecipeInput, options: PatternMixOptions = {}): PatternMixResult {
    const recentSignatures = options.recentSignatures ?? [];
    const seed = options.seed ?? Date.now() + recentSignatures.length;
    const rng = makeRng(seed);

    const pattern = this.pickPattern(input, recentSignatures, rng);
    let recipe = this.generator.buildRecipe(input, pattern);

    recipe = this.varyShotDurations(recipe, rng);
    recipe = this.varyTransitions(recipe, pattern, rng);
    recipe = this.enforceGuardrails(recipe, input);
    recipe = { ...recipe, editingSignature: buildEditingSignature(recipe.timeline, pattern.id) };

    // If, despite variation, we produced an identical signature to a recent
    // export, nudge one more transition to guarantee a different signature.
    if (recentSignatures.includes(recipe.editingSignature)) {
      recipe = this.forceDistinctSignature(recipe, pattern, recentSignatures, rng);
    }

    const variationNotes = this.buildVariationNotes(pattern, recipe);
    const coherenceScore = this.scoreCoherence(recipe, recentSignatures);

    return { recipe, coherenceScore, variationNotes };
  }

  /** Picks among the top matching patterns, preferring one whose id wasn't
   * used in the most recent export (basic "avoid repeating structure" rule). */
  private pickPattern(input: MontageRecipeInput, recentSignatures: string[], rng: () => number): MontagePattern {
    const candidates = this.library.query({
      videoType: input.videoType,
      energy: input.desiredEnergy,
      durationSeconds: input.desiredDurationSeconds,
    });
    const pool = candidates.length > 0 ? candidates.slice(0, Math.max(1, Math.min(3, candidates.length))) : this.library.all();
    const lastPatternId = recentSignatures[0]?.split("|")[0];
    const filtered = pool.length > 1 ? pool.filter((p) => p.id !== lastPatternId) : pool;
    const usable = filtered.length > 0 ? filtered : pool;
    const index = Math.floor(rng() * usable.length);
    return usable[Math.min(index, usable.length - 1)];
  }

  /** Slightly shifts internal segment boundaries (+/-10%) so shot durations
   * differ between exports, while keeping start=0 and end=total duration fixed. */
  private varyShotDurations(recipe: MontageRecipe, rng: () => number): MontageRecipe {
    const timeline = [...recipe.timeline];
    for (let i = 0; i < timeline.length - 1; i++) {
      const boundary = timeline[i].end;
      const jitterRange = boundary * 0.08;
      const jitter = (rng() - 0.5) * 2 * jitterRange;
      const minBoundary = timeline[i].start + 0.5;
      const maxBoundary = timeline[i + 1].end - 0.5;
      const newBoundary = Math.max(minBoundary, Math.min(maxBoundary, Math.round((boundary + jitter) * 10) / 10));
      timeline[i] = { ...timeline[i], end: newBoundary };
      timeline[i + 1] = { ...timeline[i + 1], start: newBoundary };
    }
    return { ...recipe, timeline };
  }

  /** Rotates transition choices using the pattern's own vocabulary so repeated
   * exports of the same pattern don't always land on the same transitions. */
  private varyTransitions(recipe: MontageRecipe, pattern: MontagePattern, rng: () => number): MontageRecipe {
    const pool = pattern.transitionStyle.filter((t) => t !== "loopable_end");
    if (pool.length === 0) return recipe;
    const offset = Math.floor(rng() * pool.length);
    const timeline = recipe.timeline.map((seg, i) => {
      if (i === recipe.timeline.length - 1) return seg; // ending handled by guardrails
      const t = pool[(i + offset) % pool.length];
      return { ...seg, transitionOut: t };
    });
    return { ...recipe, timeline };
  }

  /** Applies the hard product rules: max 3 highly visible transitions in a
   * short (<=30s) video, clear climax always present, loopable ending when
   * the base pattern supports it. */
  private enforceGuardrails(recipe: MontageRecipe, input: MontageRecipeInput): MontageRecipe {
    let timeline = [...recipe.timeline];

    if (input.desiredDurationSeconds <= 30) {
      let visibleCount = 0;
      timeline = timeline.map((seg, i) => {
        const isLast = i === timeline.length - 1;
        if (isLast) return seg;
        const isHighlyVisible = HIGH_VISIBILITY_TRANSITIONS.includes(seg.transitionOut);
        if (isHighlyVisible) {
          visibleCount++;
          if (visibleCount > 3) {
            return { ...seg, transitionOut: SUBTLE_FALLBACKS[i % SUBTLE_FALLBACKS.length] };
          }
        }
        return seg;
      });
    }

    // Clear climax: ensure the climax segment always has the highest energy.
    const climaxIndex = timeline.findIndex((s) => s.segmentType === "climax");
    if (climaxIndex >= 0) {
      const maxOtherEnergy = Math.max(...timeline.filter((_, i) => i !== climaxIndex).map((s) => s.energy));
      if (timeline[climaxIndex].energy <= maxOtherEnergy) {
        timeline[climaxIndex] = { ...timeline[climaxIndex], energy: Math.min(100, maxOtherEnergy + 5) };
      }
    }

    // Loopable ending when the recipe naturally supports it (premium_end segment present).
    const lastIndex = timeline.length - 1;
    if (timeline[lastIndex]?.segmentType === "premium_end") {
      timeline[lastIndex] = { ...timeline[lastIndex], transitionOut: "loopable_end" };
    }

    return { ...recipe, timeline };
  }

  private forceDistinctSignature(
    recipe: MontageRecipe,
    pattern: MontagePattern,
    recentSignatures: string[],
    rng: () => number
  ): MontageRecipe {
    const timeline = [...recipe.timeline];
    const pool = pattern.transitionStyle.filter((t) => t !== "loopable_end");
    let attempt = timeline;
    let signature = recipe.editingSignature;
    let guard = 0;
    while (recentSignatures.includes(signature) && guard < 5 && pool.length > 0) {
      const i = Math.floor(rng() * (timeline.length - 1));
      attempt = attempt.map((seg, idx) => (idx === i ? { ...seg, transitionOut: pool[Math.floor(rng() * pool.length)] } : seg));
      signature = buildEditingSignature(attempt, pattern.id);
      guard++;
    }
    return { ...recipe, timeline: attempt, editingSignature: signature };
  }

  private buildVariationNotes(pattern: MontagePattern, recipe: MontageRecipe): string[] {
    const notes: string[] = [`Base pattern: ${pattern.name} (${pattern.category})`];
    const transitions = recipe.timeline.map((s) => s.transitionOut).join(" \u2192 ");
    notes.push(`Transition sequence: ${transitions}`);
    const highlyVisible = recipe.timeline.filter((s) => HIGH_VISIBILITY_TRANSITIONS.includes(s.transitionOut)).length;
    notes.push(`${highlyVisible} highly visible transition(s) used (max 3 recommended for short videos)`);
    return notes;
  }

  private scoreCoherence(recipe: MontageRecipe, recentSignatures: string[]): number {
    let score = 100;

    // Penalize lack of transition variety.
    const uniqueTransitions = new Set(recipe.timeline.map((s) => s.transitionOut)).size;
    if (uniqueTransitions < 2) score -= 15;

    // Penalize energy that doesn't build toward the climax.
    const climax = recipe.timeline.find((s) => s.segmentType === "climax");
    const others = recipe.timeline.filter((s) => s.segmentType !== "climax");
    if (climax && others.some((s) => s.energy >= climax.energy)) score -= 20;

    // Penalize overusing highly visible transitions on short videos.
    const highlyVisible = recipe.timeline.filter((s) => HIGH_VISIBILITY_TRANSITIONS.includes(s.transitionOut)).length;
    if (recipe.duration <= 30 && highlyVisible > 3) score -= 15;

    // Penalize repeating a very recent signature exactly.
    if (recentSignatures.includes(recipe.editingSignature)) score -= 30;

    // Reward a loopable/premium ending.
    const last = recipe.timeline[recipe.timeline.length - 1];
    if (last?.transitionOut === "loopable_end") score += 5;

    return Math.max(0, Math.min(100, score));
  }
}

export const defaultPatternMixer = new PatternMixer();
