/**
 * AudioVideoSyncAnalyzer — MVP heuristic stub.
 *
 * Real BPM detection / beat tracking would run an audio-analysis pipeline
 * (e.g. FFT-based onset detection) against the extracted audio track. That
 * is out of scope for the MVP; this stub derives a plausible, stable
 * `AudioVideoSyncAnalysis` from the file metadata and structure analysis,
 * clearly commented for a future real audio-analysis implementation.
 */
import { AudioVideoSyncAnalysis, VideoStructureAnalysis } from "./types";
import { hashSeed, makeSeededRandom } from "./internal/seed";

export function analyzeAudioVideoSync(file: File, structure: VideoStructureAnalysis): AudioVideoSyncAnalysis {
  const rng = makeSeededRandom(hashSeed(`audio:${file.name}:${file.size}`));

  const estimatedBpm = Math.round(90 + rng() * 60); // plausible range for upbeat travel/action edits
  const beatInterval = 60 / estimatedBpm;
  const mainBeatsSeconds: number[] = [];
  for (let t = 0; t < structure.totalDurationSeconds; t += beatInterval) {
    mainBeatsSeconds.push(Math.round(t * 100) / 100);
  }

  const audioIntensityCurve = structure.energyTimeline.map((p) => ({
    time: p.time,
    intensity: Math.max(10, Math.min(100, Math.round(p.energy * 0.9 + (rng() - 0.5) * 10))),
  }));

  const musicalDrops = [structure.climaxPositionSeconds];
  const calmMomentsSeconds = structure.slowMoments;
  const impactMomentsSeconds = structure.accelerationMoments.map((m) => m.startSeconds);

  const cutsSyncedWithBeatRatio = Math.round((0.4 + rng() * 0.4) * 100) / 100;
  const transitionsSyncedWithMusicRatio = Math.round((0.3 + rng() * 0.4) * 100) / 100;

  return {
    estimatedBpm,
    mainBeatsSeconds,
    audioIntensityCurve,
    musicalDrops,
    calmMomentsSeconds,
    impactMomentsSeconds,
    cutsSyncedWithBeatRatio,
    transitionsSyncedWithMusicRatio,
  };
}
