/**
 * MontageQualityScorer — implements `calculateMontageQualityScore`, evaluating
 * a generated `MontageRecipe` (optionally alongside its `PatternMixResult`)
 * across the 8 dimensions requested by the product spec.
 */
import { MontageQualityBreakdown, MontageQualityResult, MontageRecipe } from "./types";

const HIGH_VISIBILITY_TRANSITIONS = new Set([
  "whip_pan",
  "flash_cut",
  "speed_ramp",
  "zoom_transition",
  "drone_like_reveal",
  "pov_transition",
  "map_transition",
]);

export interface QualityScoringContext {
  /** Coherence score already computed by PatternMixer, if available (0-100). */
  coherenceScore?: number;
  /** Ratio (0-1) of cuts/transitions synced with music beats, if audio analysis is available. */
  musicSyncRatio?: number;
  /** Hook score (0-100) from HookDetector, if available; otherwise derived from the recipe. */
  hookScoreOverride?: number;
}

function scoreHook(recipe: MontageRecipe, ctx: QualityScoringContext): number {
  if (ctx.hookScoreOverride != null) return clamp(ctx.hookScoreOverride);
  const hook = recipe.timeline.find((s) => s.segmentType === "hook");
  if (!hook) return 50;
  const durationOk = hook.end - hook.start <= 3.5 ? 100 : 60;
  return clamp(Math.round(hook.energy * 0.6 + durationOk * 0.4));
}

function scoreRhythm(recipe: MontageRecipe): number {
  const durations = recipe.timeline.map((s) => s.end - s.start);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((acc, d) => acc + (d - avg) ** 2, 0) / durations.length;
  const variationScore = clamp(100 - Math.abs(variance - avg) * 5);
  const buildUp = recipe.timeline.find((s) => s.segmentType === "build_up");
  const climax = recipe.timeline.find((s) => s.segmentType === "climax");
  const accelerationBonus = buildUp && climax && climax.energy > buildUp.energy ? 10 : -10;
  return clamp(Math.round(variationScore * 0.7 + 50 * 0.3 + accelerationBonus));
}

function scoreVariety(recipe: MontageRecipe): number {
  const uniqueTransitions = new Set(recipe.timeline.map((s) => s.transitionOut)).size;
  const uniqueShots = new Set(recipe.timeline.map((s) => s.shotType)).size;
  return clamp(Math.round((uniqueTransitions / recipe.timeline.length) * 60 + (uniqueShots / recipe.timeline.length) * 40));
}

function scoreEmotionalCurve(recipe: MontageRecipe): number {
  const order = ["hook", "context", "build_up", "climax", "premium_end"];
  const energies = order
    .map((type) => recipe.timeline.find((s) => s.segmentType === type)?.energy)
    .filter((e): e is number => e != null);
  if (energies.length < 3) return 50;
  const climaxIndex = order.indexOf("climax");
  const climaxEnergy = recipe.timeline.find((s) => s.segmentType === "climax")?.energy ?? 0;
  const isPeak = energies.every((e, i) => i === climaxIndex || e <= climaxEnergy);
  const hasBreathingContrast = (recipe.timeline.find((s) => s.segmentType === "premium_end")?.energy ?? 0) < climaxEnergy;
  return clamp((isPeak ? 60 : 30) + (hasBreathingContrast ? 30 : 10) + 10);
}

function scoreTransitionCoherence(recipe: MontageRecipe): number {
  const highlyVisible = recipe.timeline.filter((s) => HIGH_VISIBILITY_TRANSITIONS.has(s.transitionOut)).length;
  const isShort = recipe.duration <= 30;
  if (isShort && highlyVisible > 3) return clamp(70 - (highlyVisible - 3) * 15);
  return clamp(95 - Math.max(0, highlyVisible - 2) * 5);
}

function scoreMusicSync(ctx: QualityScoringContext): number {
  if (ctx.musicSyncRatio == null) return 60; // neutral default when no audio analysis was run yet
  return clamp(Math.round(ctx.musicSyncRatio * 100));
}

function scorePremiumFeel(recipe: MontageRecipe): number {
  const highlyVisible = recipe.timeline.filter((s) => HIGH_VISIBILITY_TRANSITIONS.has(s.transitionOut)).length;
  const overload = Math.max(0, highlyVisible - 3) * 12;
  const smoothEnding = recipe.timeline[recipe.timeline.length - 1]?.transitionOut === "loopable_end" ? 10 : 0;
  return clamp(85 - overload + smoothEnding);
}

function scoreLoopPotential(recipe: MontageRecipe): number {
  const last = recipe.timeline[recipe.timeline.length - 1];
  if (!last) return 40;
  if (last.transitionOut === "loopable_end") return 90;
  if (last.segmentType === "premium_end") return 65;
  return 45;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildRecommendations(breakdown: MontageQualityBreakdown): string[] {
  const recs: string[] = [];
  if (breakdown.hookScore < 70) recs.push("Renforcez le hook (0-3s) : mouvement plus fort, sujet plus visible, coupe plus rapide.");
  if (breakdown.rhythmScore < 70) recs.push("Variez davantage la durée des plans pour un rythme plus naturel.");
  if (breakdown.varietyScore < 60) recs.push("Ajoutez de la variété dans les transitions et les types de plans utilisés.");
  if (breakdown.emotionalCurveScore < 60) recs.push("Assurez-vous que le climax reste le pic d'énergie de la vidéo.");
  if (breakdown.transitionCoherenceScore < 70) {
    recs.push("Réduisez le nombre de transitions très visibles (whip pan, flash cut...) pour garder un rendu premium.");
  }
  if (breakdown.musicSyncScore < 60) recs.push("Synchronisez davantage les coupes avec les temps forts de la musique.");
  if (breakdown.premiumFeelScore < 70) recs.push("Simplifiez le montage : trop d'effets nuisent au rendu premium.");
  if (breakdown.loopPotentialScore < 60) {
    recs.push("Terminez sur un plan bouclable (hero shot ou retour au point de départ) pour favoriser le replay.");
  }
  if (recs.length === 0) recs.push("Montage déjà solide sur tous les critères — prêt pour l'export.");
  return recs;
}

/** Computes the overall montage quality score (0-100) and a per-dimension breakdown. */
export function calculateMontageQualityScore(recipe: MontageRecipe, context: QualityScoringContext = {}): MontageQualityResult {
  const breakdown: MontageQualityBreakdown = {
    hookScore: scoreHook(recipe, context),
    rhythmScore: scoreRhythm(recipe),
    varietyScore: scoreVariety(recipe),
    emotionalCurveScore: scoreEmotionalCurve(recipe),
    transitionCoherenceScore: scoreTransitionCoherence(recipe),
    musicSyncScore: scoreMusicSync(context),
    premiumFeelScore: scorePremiumFeel(recipe),
    loopPotentialScore: scoreLoopPotential(recipe),
  };

  const weights: Record<keyof MontageQualityBreakdown, number> = {
    hookScore: 0.2,
    rhythmScore: 0.15,
    varietyScore: 0.1,
    emotionalCurveScore: 0.15,
    transitionCoherenceScore: 0.15,
    musicSyncScore: 0.1,
    premiumFeelScore: 0.1,
    loopPotentialScore: 0.05,
  };

  const overallScore = clamp(
    (Object.keys(weights) as Array<keyof MontageQualityBreakdown>).reduce((acc, key) => acc + breakdown[key] * weights[key], 0) *
      (context.coherenceScore != null ? 0.5 + context.coherenceScore / 200 : 1)
  );

  return {
    overallScore,
    breakdown,
    recommendations: buildRecommendations(breakdown),
  };
}
