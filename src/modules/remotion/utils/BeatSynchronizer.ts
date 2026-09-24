import type { RemotionTemplateStyle } from "@/modules/remotion";
import type { CreativeVariabilityPlan } from "@/lib/creative-variability";

interface BeatSyncInput {
  id: string;
  start: number;
  end: number;
  confidence: number;
  energy: number;
}

export interface BeatSyncPlan {
  clips: Array<{ id: string; start: number; end: number }>;
  beatMarkers: number[];
  averageShotLength: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function targetDurationFor(style: RemotionTemplateStyle, energy: number) {
  if (style === "viral") return clamp(1.9 - energy * 1.15, 0.5, 2.0);
  if (style === "sport") return clamp(2.2 - energy * 0.95, 0.8, 2.4);
  return clamp(3.2 - energy * 0.8, 1.2, 3.6);
}

export function buildBeatSyncPlan(clips: BeatSyncInput[], style: RemotionTemplateStyle, creativityPlan?: CreativeVariabilityPlan | null): BeatSyncPlan {
  const normalized = clips.map((clip) => {
    const desiredDuration = targetDurationFor(style, clip.energy) * (creativityPlan?.selectedVersion.clipDurationMultiplier ?? 1);
    const actualDuration = Math.max(0.45, clip.end - clip.start);
    const tolerance = creativityPlan?.selectedVersion.beatSyncTolerance ?? 0.08;
    const duration = Math.min(actualDuration, desiredDuration + tolerance);
    return {
      id: clip.id,
      start: clip.start,
      end: clip.start + duration,
      duration,
    };
  });

  const beatMarkers: number[] = [];
  let cursor = 0;
  for (const clip of normalized) {
    cursor += clip.duration;
    beatMarkers.push(Number(cursor.toFixed(3)));
  }

  return {
    clips: normalized.map(({ id, start, end }) => ({ id, start, end })),
    beatMarkers,
    averageShotLength:
      normalized.length > 0 ? normalized.reduce((sum, clip) => sum + clip.duration, 0) / normalized.length : 0,
  };
}
