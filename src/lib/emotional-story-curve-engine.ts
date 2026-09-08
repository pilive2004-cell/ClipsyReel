import { BestMoment, EmotionalStoryBeat, EmotionalStoryRole, EmotionalStoryTimeline, GpxRouteStats, ReelStyle } from "@/types";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function secondsToLabel(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

type StyleCurveConfig = {
  windows: Record<Exclude<EmotionalStoryRole, "thumbnail-moment">, [number, number]>;
  intensities: Record<Exclude<EmotionalStoryRole, "thumbnail-moment">, number>;
};

const BASE_WINDOWS: StyleCurveConfig["windows"] = {
  "opening-hook": [0, 3],
  context: [3, 6],
  journey: [6, 15],
  discovery: [15, 18],
  "peak-moment": [18, 24],
  "emotional-ending": [24, 30],
};

const BASE_INTENSITIES: StyleCurveConfig["intensities"] = {
  "opening-hook": 95,
  context: 55,
  journey: 75,
  discovery: 85,
  "peak-moment": 100,
  "emotional-ending": 50,
};

function styleCurveConfig(style: ReelStyle): StyleCurveConfig {
  const cfg: StyleCurveConfig = {
    windows: { ...BASE_WINDOWS },
    intensities: { ...BASE_INTENSITIES },
  };
  if (style === "viral") {
    cfg.windows.context = [2, 4.5];
    cfg.windows.journey = [4.5, 12.5];
    cfg.windows.discovery = [13, 16];
    cfg.windows["peak-moment"] = [16, 21];
    cfg.windows["emotional-ending"] = [21, 28];
    cfg.intensities["opening-hook"] = 98;
    cfg.intensities.context = 50;
    cfg.intensities.journey = 82;
    cfg.intensities["emotional-ending"] = 46;
  } else if (style === "adventure") {
    cfg.windows.context = [3, 7];
    cfg.windows.journey = [7, 16];
    cfg.windows.discovery = [16, 19.5];
    cfg.windows["peak-moment"] = [19.5, 24.5];
    cfg.intensities.context = 62;
    cfg.intensities.journey = 78;
    cfg.intensities.discovery = 88;
    cfg.intensities["emotional-ending"] = 54;
  } else if (style === "cinematic") {
    cfg.windows.journey = [6, 16];
    cfg.windows.discovery = [16, 20];
    cfg.windows["peak-moment"] = [20, 24];
    cfg.windows["emotional-ending"] = [24, 32];
    cfg.intensities["opening-hook"] = 88;
    cfg.intensities.context = 60;
    cfg.intensities.journey = 68;
    cfg.intensities.discovery = 82;
    cfg.intensities["emotional-ending"] = 58;
  } else if (style === "sport") {
    cfg.windows.context = [2.5, 5.5];
    cfg.windows.journey = [5.5, 13.5];
    cfg.windows.discovery = [13.5, 17];
    cfg.windows["peak-moment"] = [17, 22];
    cfg.windows["emotional-ending"] = [22, 28];
    cfg.intensities["opening-hook"] = 97;
    cfg.intensities.context = 52;
    cfg.intensities.journey = 86;
    cfg.intensities.discovery = 90;
    cfg.intensities["emotional-ending"] = 45;
  } else if (style === "luxury") {
    cfg.windows.context = [3, 7];
    cfg.windows.journey = [7, 17];
    cfg.windows.discovery = [17, 21];
    cfg.windows["peak-moment"] = [21, 25];
    cfg.windows["emotional-ending"] = [25, 33];
    cfg.intensities["opening-hook"] = 90;
    cfg.intensities.context = 58;
    cfg.intensities.journey = 72;
    cfg.intensities.discovery = 80;
    cfg.intensities["peak-moment"] = 97;
    cfg.intensities["emotional-ending"] = 60;
  } else if (style === "travel") {
    cfg.windows.context = [3, 7];
    cfg.windows.journey = [7, 16];
    cfg.windows.discovery = [16, 20];
    cfg.windows["peak-moment"] = [20, 24];
    cfg.windows["emotional-ending"] = [24, 31];
    cfg.intensities.context = 60;
    cfg.intensities.journey = 76;
    cfg.intensities.discovery = 87;
    cfg.intensities["emotional-ending"] = 55;
  }
  return cfg;
}

const EMOTION_BY_ROLE: Record<Exclude<EmotionalStoryRole, "thumbnail-moment">, string> = {
  "opening-hook": "Excitement",
  context: "Curiosity",
  journey: "Anticipation",
  discovery: "Wonder",
  "peak-moment": "Wow effect",
  "emotional-ending": "Reflection",
};

function scoreForRole(moment: BestMoment, role: Exclude<EmotionalStoryRole, "context" | "thumbnail-moment">): number {
  const b = moment.scoreBreakdown;
  const confidence = moment.confidence / 100;
  const motion = b?.motion ?? confidence;
  const clarity = b?.clarity ?? confidence;
  const visual = b?.visualImpact ?? confidence;
  const emotion = b?.emotion ?? confidence;
  const gpx = b?.gpxContext ?? 0.5;
  const retention = b?.retention ?? confidence;
  if (role === "opening-hook") return 0.3 * retention + 0.25 * motion + 0.2 * clarity + 0.25 * visual;
  if (role === "journey") return 0.28 * motion + 0.26 * gpx + 0.2 * retention + 0.26 * visual;
  if (role === "discovery") return 0.34 * visual + 0.28 * gpx + 0.22 * emotion + 0.16 * clarity;
  if (role === "peak-moment") return 0.46 * visual + 0.28 * confidence + 0.16 * emotion + 0.1 * motion;
  return 0.35 * emotion + 0.3 * clarity + 0.2 * visual + 0.15 * (1 - motion);
}

function pickMoment(
  moments: BestMoment[],
  used: Set<string>,
  role: Exclude<EmotionalStoryRole, "context" | "thumbnail-moment">,
  preferredWindow: [number, number]
) {
  const [w0, w1] = preferredWindow;
  const candidates = moments.filter((m) => !used.has(m.id));
  const ranked = candidates
    .map((m) => {
      const center = (m.startSeconds + m.endSeconds) / 2;
      const inWindow = center >= w0 && center <= w1 ? 1 : 0;
      const dist = inWindow ? 0 : Math.min(Math.abs(center - w0), Math.abs(center - w1));
      const windowFit = inWindow ? 1 : clamp(1 - dist / 12, 0, 1);
      const roleScore = scoreForRole(m, role);
      return { m, score: roleScore * 0.82 + windowFit * 0.18 };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.m ?? null;
}

function buildBeat(
  role: Exclude<EmotionalStoryRole, "thumbnail-moment">,
  intensity: number,
  window: [number, number],
  moment?: BestMoment | null
): EmotionalStoryBeat {
  const start = moment ? moment.startSeconds : window[0];
  const end = moment ? moment.endSeconds : window[1];
  return {
    role,
    intensity,
    targetEmotion: EMOTION_BY_ROLE[role],
    startSeconds: start,
    endSeconds: end,
    startTime: secondsToLabel(start),
    endTime: secondsToLabel(end),
    duration: Math.max(0.3, end - start),
    sourceIndex: moment?.sourceIndex,
    momentId: moment?.id,
  };
}

function pickThumbnailMoment(moments: BestMoment[], deniedIds: Set<string>): EmotionalStoryBeat | null {
  const candidate = moments
    .filter((m) => !deniedIds.has(m.id))
    .sort((a, b) => {
      const av = (a.scoreBreakdown?.visualImpact ?? a.confidence / 100) + (a.scoreBreakdown?.clarity ?? a.confidence / 100);
      const bv = (b.scoreBreakdown?.visualImpact ?? b.confidence / 100) + (b.scoreBreakdown?.clarity ?? b.confidence / 100);
      return bv - av;
    })[0];
  if (!candidate) return null;
  return {
    role: "thumbnail-moment",
    intensity: 92,
    targetEmotion: "Stop-scroll visual",
    startSeconds: candidate.startSeconds,
    endSeconds: candidate.endSeconds,
    startTime: secondsToLabel(candidate.startSeconds),
    endTime: secondsToLabel(candidate.endSeconds),
    duration: Math.max(0.3, candidate.endSeconds - candidate.startSeconds),
    sourceIndex: candidate.sourceIndex,
    momentId: candidate.id,
  };
}

function scoreTimeline(curve: EmotionalStoryBeat[]): number {
  const intensities = curve.map((c) => c.intensity);
  const mean = intensities.reduce((s, v) => s + v, 0) / intensities.length;
  const variance = intensities.reduce((s, v) => s + (v - mean) ** 2, 0) / intensities.length;
  const hasPeak = curve.filter((c) => c.role === "peak-moment").length === 1;
  const startsStrong = intensities[0] >= 88;
  const endsLower = intensities[intensities.length - 1] <= 65;
  const score = 58 + Math.min(22, variance * 0.03) + (hasPeak ? 8 : 0) + (startsStrong ? 6 : 0) + (endsLower ? 6 : 0);
  return Math.round(clamp(score, 0, 100));
}

export function buildEmotionalStoryTimeline(
  videoFile: File | null,
  selectedStyle: ReelStyle,
  gpxData: GpxRouteStats | null = null,
  options: { bestMoments?: BestMoment[]; durationSeconds?: number } = {}
): EmotionalStoryTimeline {
  const cfg = styleCurveConfig(selectedStyle);
  const bestMoments = [...(options.bestMoments ?? [])];
  const used = new Set<string>();
  const openingHookMoment = pickMoment(bestMoments, used, "opening-hook", cfg.windows["opening-hook"]);
  if (openingHookMoment) used.add(openingHookMoment.id);
  const journeyMoment = pickMoment(bestMoments, used, "journey", cfg.windows.journey);
  if (journeyMoment) used.add(journeyMoment.id);
  const discoveryMoment = pickMoment(bestMoments, used, "discovery", cfg.windows.discovery);
  if (discoveryMoment) used.add(discoveryMoment.id);
  const peakMoment = pickMoment(bestMoments, used, "peak-moment", cfg.windows["peak-moment"]);
  if (peakMoment) used.add(peakMoment.id);
  const endingMoment = pickMoment(bestMoments, used, "emotional-ending", cfg.windows["emotional-ending"]);
  if (endingMoment) used.add(endingMoment.id);

  const contextWindow = cfg.windows.context;
  const contextLabel = gpxData ? "Curiosity · Route context" : "Curiosity · Story context";
  const openingHook = buildBeat("opening-hook", cfg.intensities["opening-hook"], cfg.windows["opening-hook"], openingHookMoment);
  const contextSection: EmotionalStoryBeat = {
    role: "context",
    intensity: cfg.intensities.context,
    targetEmotion: contextLabel,
    startSeconds: contextWindow[0],
    endSeconds: contextWindow[1],
    startTime: secondsToLabel(contextWindow[0]),
    endTime: secondsToLabel(contextWindow[1]),
    duration: contextWindow[1] - contextWindow[0],
  };
  const journeySection = buildBeat("journey", cfg.intensities.journey, cfg.windows.journey, journeyMoment);
  const discoverySection = buildBeat("discovery", cfg.intensities.discovery, cfg.windows.discovery, discoveryMoment);
  const peakSection = buildBeat("peak-moment", cfg.intensities["peak-moment"], cfg.windows["peak-moment"], peakMoment);
  const emotionalEnding = buildBeat("emotional-ending", cfg.intensities["emotional-ending"], cfg.windows["emotional-ending"], endingMoment);
  const thumbnailMoment = pickThumbnailMoment(bestMoments, used);
  const emotionalCurve = [openingHook, contextSection, journeySection, discoverySection, peakSection, emotionalEnding];
  const reelScore = scoreTimeline(emotionalCurve);
  void videoFile;
  return {
    openingHook,
    contextSection,
    journeySection,
    discoverySection,
    peakMoment: peakSection,
    emotionalEnding,
    thumbnailMoment,
    emotionalCurve,
    reelScore,
  };
}
