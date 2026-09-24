import { BestMoment } from "@/types";
import { analyzeMomentEnergy, summarizeEnergyProfile } from "@/modules/remotion/utils/EnergyAnalyzer";
import { buildBeatSyncPlan } from "@/modules/remotion/utils/BeatSynchronizer";
import { buildTransitionSequence, RemotionTransitionType } from "@/modules/remotion/utils/TransitionSelector";
import {
  buildCreativeVariabilityPlan,
  type CreativeCameraMove,
  type CreativeOverlayAnimation,
  type CreativeVariabilityPlan,
  type CreativeVariabilitySettings,
} from "@/lib/creative-variability";

export type RemotionTemplateStyle = "sport" | "viral" | "adventure" | "cinematic";

export interface RemotionGraphicPlan {
  type: "speed" | "map" | "title" | "stats" | "progress" | "location" | "action-title";
  value?: number;
  unit?: string;
  position?: "bottom-right" | "top-left" | "top-right" | "bottom-left" | "center";
  title?: string;
  subtitle?: string;
  accent?: "cyan" | "amber" | "pink" | "lime" | "violet" | "white";
  entranceAnimation?: CreativeOverlayAnimation;
  durationSeconds?: number;
}

export interface RemotionTransitionPlan {
  type: RemotionTransitionType;
  duration: number;
  direction: "left" | "right" | "up" | "down";
  energyBand: "low" | "medium" | "high";
}

export interface RemotionClipPlan {
  id: string;
  start: number;
  end: number;
  confidence: number;
  energy: number;
  energyBand: "low" | "medium" | "high";
  emphasis: "smooth" | "punch" | "impact";
  cameraMove: CreativeCameraMove;
}

export interface RemotionTimelinePlan {
  style: RemotionTemplateStyle;
  variant: string;
  title?: string;
  hookText?: string;
  overlayTexts?: string[];
  clips: RemotionClipPlan[];
  transitions: RemotionTransitionPlan[];
  graphics: RemotionGraphicPlan[];
  beatMarkers: number[];
  averageShotLength: number;
  energySummary: {
    average: number;
    peak: number;
    band: "low" | "medium" | "high";
  };
  variability: CreativeVariabilityPlan | null;
}

function resolveTemplateVariant(style: RemotionTemplateStyle, energyBand: "low" | "medium" | "high") {
  if (style === "viral") {
    return energyBand === "high" ? "viral_impact" : energyBand === "medium" ? "viral_pulse" : "viral_glide";
  }
  if (style === "sport") return "sport_dynamic";
  if (style === "adventure") return "adventure_route";
  return "cinematic_wave";
}

export function buildRemotionPlanFromMoments(
  moments: BestMoment[],
  style: RemotionTemplateStyle = "sport",
  variant?: string,
  metadata: {
    title?: string;
    hookText?: string;
    overlayTexts?: string[];
  } = {},
  creativitySettings?: CreativeVariabilitySettings
): RemotionTimelinePlan {
  const sourceMoments = moments.slice(0, style === "viral" ? 8 : 6);
  const creativityPlan = buildCreativeVariabilityPlan({
    style: style === "viral" ? "viral" : "cinematic",
    moments: sourceMoments,
    clipCount: sourceMoments.length,
    overlayCount: metadata.overlayTexts?.length ?? 0,
    settings: creativitySettings,
  });
  const clipProfiles = sourceMoments.map((moment) => {
    const energyProfile = analyzeMomentEnergy(moment);
    return {
      moment,
      energyProfile,
    };
  });

  const beatPlan = buildBeatSyncPlan(
    clipProfiles.map(({ moment, energyProfile }) => ({
      id: moment.id,
      start: moment.startSeconds,
      end: moment.endSeconds,
      confidence: moment.confidence,
      energy: energyProfile.score,
    })),
    style,
    creativityPlan
  );

  const clips: RemotionClipPlan[] = clipProfiles.map(({ moment, energyProfile }, index) => {
    const beatWindow = beatPlan.clips[index];
    const start = beatWindow?.start ?? moment.startSeconds;
    const end = beatWindow?.end ?? moment.endSeconds;
    return {
      id: moment.id,
      start,
      end: Math.max(end, start + 0.45),
      confidence: moment.confidence,
      energy: energyProfile.score,
      energyBand: energyProfile.band,
      emphasis: energyProfile.band === "high" ? "impact" : energyProfile.band === "medium" ? "punch" : "smooth",
      cameraMove: creativityPlan?.selectedVersion.cameraMoves[index] ?? (energyProfile.band === "high" ? "fast-zoom-in" : energyProfile.band === "medium" ? "pan-right" : "slow-zoom-in"),
    };
  });

  const transitions = buildTransitionSequence(
    clips.map((clip) => ({
      id: clip.id,
      energy: clip.energy,
      start: clip.start,
      end: clip.end,
    })),
    style,
    creativityPlan
  );

  const cleanedOverlayTexts = (metadata.overlayTexts ?? [])
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 3);

  const energySummary = summarizeEnergyProfile(clips.map((clip) => clip.energy));
  const resolvedVariant = variant ?? resolveTemplateVariant(style, energySummary.band);

  const graphics: RemotionGraphicPlan[] = [];
  if (metadata.title?.trim()) {
    graphics.push({
      type: "action-title",
      title: metadata.title.trim(),
      subtitle: metadata.hookText?.trim() || cleanedOverlayTexts[0],
      accent: style === "viral" ? "amber" : "cyan",
      position: creativityPlan?.selectedVersion.titleAnchor ?? "top-left",
      entranceAnimation: creativityPlan?.selectedVersion.titleAnimation ?? "slide-in",
      durationSeconds: 2.6,
    });
  }
  if (style === "viral") {
    graphics.push(
      {
        type: "progress",
        value: 100,
        unit: "%",
        position: creativityPlan?.selectedVersion.titleAnchor === "top-right" ? "top-left" : "top-right",
        accent: energySummary.band === "high" ? "pink" : "amber",
        entranceAnimation: creativityPlan?.selectedVersion.hookAnimations[0] ?? "swipe-in",
        durationSeconds: 2.8,
      },
      {
        type: "stats",
        title: "Energy",
        subtitle: `${Math.round(energySummary.average * 100)}% match`,
        position: creativityPlan?.selectedVersion.hookAnchors[0] ?? "bottom-left",
        accent: energySummary.band === "high" ? "pink" : "violet",
        entranceAnimation: creativityPlan?.selectedVersion.hookAnimations[1] ?? "scale-in",
        durationSeconds: 3.2,
      }
    );
  }
  if (style === "sport") {
    graphics.push(
      ...clips.slice(0, 2).map((clip, index) => ({
        type: "speed" as const,
        value: Math.round(58 + clip.confidence * 0.45 + clip.energy * 18),
        unit: "km/h",
        position: index % 2 === 0 ? ("bottom-right" as const) : ("top-left" as const),
      }))
    );
  }

  return {
    style,
    variant: resolvedVariant,
    title: metadata.title?.trim() || undefined,
    hookText: metadata.hookText?.trim() || undefined,
    overlayTexts: cleanedOverlayTexts,
    clips,
    transitions,
    graphics,
    beatMarkers: beatPlan.beatMarkers,
    averageShotLength: beatPlan.averageShotLength,
    energySummary,
    variability: creativityPlan,
  };
}
