/**
 * MotionEnergyAnalyzer — MVP heuristic stub.
 *
 * Real motion-energy estimation would use optical flow / frame-difference
 * analysis on decoded video frames. For the MVP this simply re-exposes the
 * energy timeline already computed by `VideoStructureAnalyzer`, smoothed,
 * so callers have a single, clearly-named entry point to swap out later.
 */
import { VideoStructureAnalysis } from "./types";

export interface MotionEnergyProfile {
  timeline: Array<{ time: number; energy: number }>;
  averageEnergy: number;
  peakEnergy: number;
  peakTimeSeconds: number;
}

export function analyzeMotionEnergy(structure: VideoStructureAnalysis): MotionEnergyProfile {
  const timeline = structure.energyTimeline;
  const averageEnergy = timeline.reduce((a, p) => a + p.energy, 0) / timeline.length;
  const peak = timeline.reduce((best, p) => (p.energy > best.energy ? p : best), timeline[0]);

  return {
    timeline,
    averageEnergy: Math.round(averageEnergy),
    peakEnergy: peak.energy,
    peakTimeSeconds: peak.time,
  };
}
