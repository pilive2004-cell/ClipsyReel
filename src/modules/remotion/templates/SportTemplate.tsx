"use client";

import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { HookTextPanel } from "@/modules/remotion/graphics/HookTextPanel";
import { SpeedIndicator } from "@/modules/remotion/overlays/SpeedIndicator";
import { buildRemotionPlanFromMoments, RemotionTimelinePlan } from "@/modules/remotion/index";
import { SlideTransition } from "@/modules/remotion/transitions/SlideTransition";
import { BestMoment } from "@/types";

export function SportTemplate({
  moments,
  title,
  hookText,
  overlayTexts,
}: {
  moments: BestMoment[];
  title?: string;
  hookText?: string;
  overlayTexts?: string[];
}) {
  const plan = buildRemotionPlanFromMoments(moments, "sport", "sport_dynamic", { title, hookText, overlayTexts });
  return <SportTemplateFromPlan plan={plan} />;
}

export function SportTemplateFromPlan({ plan }: { plan: RemotionTimelinePlan }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at top, #1d4ed8 0%, #050816 60%, #02040a 100%)" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity,
          background: "linear-gradient(135deg, rgba(11,15,32,0.35), rgba(59,130,246,0.22))",
        }}
      />

      {plan.transitions.map((transition, index) => (
        <Sequence key={`transition-${index}`} from={index * 24 + 12} durationInFrames={18}>
          <SlideTransition direction={index % 2 === 0 ? "left" : "right"} />
        </Sequence>
      ))}

      {plan.graphics.map((graphic, index) => (
        <Sequence key={`${graphic.type}-${index}`} from={index * 18} durationInFrames={60}>
          {graphic.type === "speed" && graphic.value !== undefined ? (
            <SpeedIndicator
              value={graphic.value}
              unit={graphic.unit ?? "km/h"}
              position={graphic.position === "top-left" ? "top-left" : "bottom-right"}
            />
          ) : null}
        </Sequence>
      ))}

      <div
        style={{
          position: "absolute",
          left: 32,
          top: 32,
          color: "white",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          transform: `translateX(${interpolate(frame, [0, 18], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {plan.title?.toUpperCase() || "SPORT"}
      </div>

      {plan.hookText ? (
        <Sequence from={8} durationInFrames={90}>
          <HookTextPanel text={plan.hookText} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}
