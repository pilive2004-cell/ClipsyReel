import { BestMoment } from "@/types";

export interface MomentEnergyProfile {
  score: number;
  band: "low" | "medium" | "high";
  motionIntensity: number;
  cameraMovement: number;
  subjectSpeed: number;
  sceneDynamics: number;
}

export interface EnergySummary {
  average: number;
  peak: number;
  band: "low" | "medium" | "high";
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function analyzeMomentEnergy(moment: BestMoment): MomentEnergyProfile {
  const breakdown = moment.scoreBreakdown;
  const motionIntensity = clamp01(breakdown?.motionIntensity ?? breakdown?.motion ?? moment.confidence / 100);
  const cameraMovement = clamp01(1 - (breakdown?.stability ?? 0.55));
  const subjectSpeed = clamp01((breakdown?.visualImpact ?? motionIntensity) * 0.65 + motionIntensity * 0.35);
  const sceneDynamics = clamp01((breakdown?.sceneChange ?? 0.45) * 0.7 + (breakdown?.contrast ?? 0.45) * 0.3);
  const score = clamp01(
    motionIntensity * 0.34 +
      cameraMovement * 0.18 +
      subjectSpeed * 0.22 +
      sceneDynamics * 0.16 +
      clamp01(moment.confidence / 100) * 0.1
  );
  const band = score >= 0.72 ? "high" : score >= 0.42 ? "medium" : "low";
  return { score, band, motionIntensity, cameraMovement, subjectSpeed, sceneDynamics };
}

export function summarizeEnergyProfile(scores: number[]): EnergySummary {
  if (scores.length === 0) {
    return { average: 0.42, peak: 0.42, band: "medium" as const };
  }
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const peak = Math.max(...scores);
  const band = peak >= 0.72 || average >= 0.62 ? "high" : average >= 0.42 ? "medium" : "low";
  return { average, peak, band };
}
