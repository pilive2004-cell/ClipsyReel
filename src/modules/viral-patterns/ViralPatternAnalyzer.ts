/**
 * ViralPatternAnalyzer — orchestrates the MVP analysis stubs into a single
 * `ViralPatternAnalysisResult` for one user-supplied reference video, and
 * derives a storable `MontagePattern` (abstract structure only) from it.
 *
 * IMPORTANT: this only ever operates on a local `File` object the user
 * explicitly selected in their own browser. There is no network fetch, no
 * download, and no persistence of the raw video/audio anywhere in this
 * module — only the derived abstract metrics below are kept.
 */
import { hashSeed } from "./internal/seed";
import { analyzeStructure } from "./VideoStructureAnalyzer";
import { detectHook } from "./HookDetector";
import { analyzeCutRhythm } from "./CutRhythmAnalyzer";
import { detectTransitionPatterns } from "./TransitionPatternDetector";
import { analyzeAudioVideoSync } from "./AudioVideoSyncAnalyzer";
import { extractEmotionalCurve } from "./EmotionalCurveExtractor";
import { EnergyLevel, MontagePattern, MontagePatternCategory, TransitionType, ViralPatternAnalysisResult, VideoType } from "./types";

const ALL_VIDEO_TYPES: VideoType[] = ["motorcycle", "road_trip", "travel", "offroad", "drone", "city", "mountain"];

export async function analyzeReferenceVideo(file: File): Promise<ViralPatternAnalysisResult> {
  const structure = await analyzeStructure(file);
  const hook = detectHook(file, structure);
  const rhythm = analyzeCutRhythm(file, structure);
  const transitions = detectTransitionPatterns(file, rhythm);
  const audioSync = analyzeAudioVideoSync(file, structure);
  const emotionalCurve = extractEmotionalCurve(structure, hook);

  const derivedPattern = derivePattern(file, structure, hook, rhythm, transitions, emotionalCurve);

  return {
    sourceFileName: file.name,
    structure,
    hook,
    rhythm,
    transitions,
    audioSync,
    emotionalCurve,
    derivedPattern,
  };
}

function energyProfileFor(avgEnergy: number): EnergyLevel {
  if (avgEnergy < 40) return "calm";
  if (avgEnergy < 65) return "balanced";
  if (avgEnergy < 85) return "dynamic";
  return "extreme";
}

function categoryFor(avgEnergy: number, hookScore: number): MontagePatternCategory {
  if (hookScore >= 85) return "Fast Adventure Hook";
  if (avgEnergy >= 80) return "High Energy Action";
  if (avgEnergy < 45) return "Calm Premium Travel";
  return "Cinematic Road Trip";
}

function derivePattern(
  file: File,
  structure: ViralPatternAnalysisResult["structure"],
  hook: ViralPatternAnalysisResult["hook"],
  rhythm: ViralPatternAnalysisResult["rhythm"],
  transitions: ViralPatternAnalysisResult["transitions"],
  emotionalCurve: ViralPatternAnalysisResult["emotionalCurve"]
): MontagePattern {
  const avgEnergy = structure.energyTimeline.reduce((a, p) => a + p.energy, 0) / structure.energyTimeline.length;
  const energyProfile = energyProfileFor(avgEnergy);
  const category = categoryFor(avgEnergy, hook.hookScore);

  const uniqueTransitions = Array.from(new Set(transitions.map((t) => t.transitionType))) as TransitionType[];

  return {
    id: `user-${hashSeed(`${file.name}:${file.size}:${structure.totalDurationSeconds}`)}`,
    name: `Analyzed: ${file.name}`,
    category,
    sourceType: "user_supplied",
    durationRange: [
      Math.max(10, Math.round(structure.totalDurationSeconds * 0.7)),
      Math.max(15, Math.round(structure.totalDurationSeconds * 1.4)),
    ],
    idealVideoType: ALL_VIDEO_TYPES,
    energyProfile,
    cutRhythm: {
      fastCutRatio: rhythm.fastCutRatio,
      slowCutRatio: rhythm.slowCutRatio,
      hasAccelerationBeforeClimax: rhythm.hasAccelerationBeforeClimax,
    },
    transitionStyle: uniqueTransitions.length > 0 ? uniqueTransitions : ["direct_cut"],
    hookStyle: {
      minHookScore: Math.max(0, hook.hookScore - 10),
      preferredShot: "best_motion_or_landscape",
    },
    emotionalCurve,
    recommendedFor: [`Footage with similar rhythm (${Math.round(rhythm.fastCutRatio * 100)}% fast cuts)`, "Videos with a comparable energy profile"],
    avoidWhen: ["Footage with very different pacing or duration"],
    uniquenessScore: Math.round(50 + (rhythm.wideCloseAlternationScore / 100) * 40),
    premiumScore: Math.round(40 + hook.hookScore * 0.3 + (structure.endingType === "hero_shot" || structure.endingType === "loop" ? 15 : 0)),
  };
}
