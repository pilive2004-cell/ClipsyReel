"use client";

import { AbsoluteFill, Sequence } from "remotion";
import { BestMoment } from "@/types";
import { buildRemotionPlanFromMoments, RemotionTimelinePlan } from "@/modules/remotion";
import type { CreativeVariabilitySettings } from "@/lib/creative-variability";
import { ActionTitleCard } from "@/modules/remotion/overlays/ActionTitleCard";
import { ProgressBar } from "@/modules/remotion/overlays/ProgressBar";
import { StatsCard } from "@/modules/remotion/overlays/StatsCard";
import { ViralHookLowerThird } from "@/modules/remotion/graphics/ViralHookLowerThird";
import { ViralTransitionEngine } from "@/modules/remotion/transitions/ViralTransitionEngine";
import { VelocityZoom } from "@/modules/remotion/effects/VelocityZoom";
import { PunchZoom } from "@/modules/remotion/effects/PunchZoom";
import { MotionBlur } from "@/modules/remotion/effects/MotionBlur";
import { GlitchBurst } from "@/modules/remotion/effects/GlitchBurst";
import { CameraShake } from "@/modules/remotion/effects/CameraShake";

function ViralBackdrop({ plan }: { plan: RemotionTimelinePlan }) {
  const palette =
    plan.energySummary.band === "high"
      ? ["#1f1147", "#db2777", "#0f172a"]
      : plan.energySummary.band === "medium"
        ? ["#3b0764", "#f59e0b", "#0f172a"]
        : ["#0f172a", "#1d4ed8", "#111827"];
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at top, ${palette[1]}22 0%, ${palette[0]} 32%, ${palette[2]} 82%)`,
      }}
    />
  );
}

function ViralMotionLayer({ plan }: { plan: RemotionTimelinePlan }) {
  const intensity = Math.max(0.7, plan.energySummary.peak * 1.2);
  const content = (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 26%, rgba(0,0,0,0.24) 100%)",
        }}
      />
    </AbsoluteFill>
  );

  if (plan.energySummary.band === "high") {
    return (
      <CameraShake intensity={intensity * 0.45}>
        <GlitchBurst intensity={intensity * 0.5}>
          <PunchZoom intensity={intensity * 0.5}>{content}</PunchZoom>
        </GlitchBurst>
      </CameraShake>
    );
  }
  if (plan.energySummary.band === "medium") {
    return (
      <MotionBlur intensity={0.25 + intensity * 0.15}>
        <PunchZoom intensity={0.35}>{content}</PunchZoom>
      </MotionBlur>
    );
  }
  return <VelocityZoom intensity={0.28}>{content}</VelocityZoom>;
}

export function ViralTemplate({
  moments,
  title,
  hookText,
  overlayTexts,
  creativitySettings,
}: {
  moments: BestMoment[];
  title?: string;
  hookText?: string;
  overlayTexts?: string[];
  creativitySettings?: CreativeVariabilitySettings;
}) {
  const plan = buildRemotionPlanFromMoments(moments, "viral", undefined, { title, hookText, overlayTexts }, creativitySettings);
  return <ViralTemplateFromPlan plan={plan} />;
}

export function ViralTemplateFromPlan({ plan }: { plan: RemotionTimelinePlan }) {
  const heroTitle = plan.title || "VIRAL";
  return (
    <AbsoluteFill>
      <ViralBackdrop plan={plan} />
      <ViralMotionLayer plan={plan} />

      {plan.transitions.map((transition, index) => (
        <Sequence key={`${transition.type}-${index}`} from={index * 16 + 10} durationInFrames={18}>
          <ViralTransitionEngine type={transition.type} direction={transition.direction} />
        </Sequence>
      ))}

      <ActionTitleCard title={heroTitle} />
      <ProgressBar progress={92 + plan.energySummary.average * 8} accent={plan.energySummary.band === "high" ? "#f472b6" : "#f59e0b"} />
      <StatsCard
        title={`${Math.round(plan.averageShotLength * 10) / 10}s avg`}
        subtitle={`${plan.transitions.length} transitions • ${plan.variant.replaceAll("_", " ")}`}
        accent={plan.energySummary.band === "high" ? "#f472b6" : "#a855f7"}
      />

      {plan.overlayTexts?.slice(0, 2).map((text, index) => (
        <Sequence key={`${text}-${index}`} from={index * 34 + 18} durationInFrames={58}>
          <ViralHookLowerThird text={text} durationInFrames={58} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
