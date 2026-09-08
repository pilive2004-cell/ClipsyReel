/**
 * HookDetector — MVP heuristic stub focused on the first 3 seconds.
 *
 * Real hook analysis would run computer vision (motion estimation, subject
 * detection, contrast/sharpness metrics, OCR for hook text) on the first
 * ~3s of decoded frames. That is out of scope for the MVP; this stub derives
 * a plausible, stable `HookAnalysis` from local file metadata + the already
 * computed structure analysis, and should be replaced frame-by-frame later
 * without changing the `HookAnalysis` shape.
 */
import { HookAnalysis, VideoStructureAnalysis } from "./types";
import { hashSeed, makeSeededRandom } from "./internal/seed";

export function detectHook(file: File, structure: VideoStructureAnalysis): HookAnalysis {
  const rng = makeSeededRandom(hashSeed(`hook:${file.name}:${file.size}`));

  const earlyEnergy = structure.energyTimeline.filter((p) => p.time <= 3).map((p) => p.energy);
  const avgEarlyEnergy = earlyEnergy.length > 0 ? earlyEnergy.reduce((a, b) => a + b, 0) / earlyEnergy.length : 60;

  const strongMotion = clamp(avgEarlyEnergy * 0.9 + rng() * 15);
  const clearImage = clamp(65 + rng() * 30);
  const visualSurprise = clamp(40 + rng() * 45);
  const spectacularEnvironment = clamp(50 + rng() * 40);
  const visibleSubjectOrAction = clamp(55 + rng() * 35);
  const fastShotChange = clamp(structure.cutsPerSecond > 1 ? 80 + rng() * 15 : 40 + rng() * 30);
  const hasHookText = rng() > 0.5;
  const visualContrast = clamp(50 + rng() * 40);
  const cameraMovement = clamp(45 + rng() * 45);
  const unexpectedElement = clamp(35 + rng() * 45);

  const components = [
    strongMotion,
    clearImage,
    visualSurprise,
    spectacularEnvironment,
    visibleSubjectOrAction,
    fastShotChange,
    visualContrast,
    cameraMovement,
    unexpectedElement,
  ];
  const hookScore = clamp(components.reduce((a, b) => a + b, 0) / components.length + (hasHookText ? 3 : 0));

  return {
    strongMotion,
    clearImage,
    visualSurprise,
    spectacularEnvironment,
    visibleSubjectOrAction,
    fastShotChange,
    hasHookText,
    visualContrast,
    cameraMovement,
    unexpectedElement,
    hookScore,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
