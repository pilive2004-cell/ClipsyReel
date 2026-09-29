"use client";

import { useCurrentFrame, useVideoConfig } from "remotion";
import { getViralTransitionState } from "@/modules/remotion/motion/viralMotion";
import { RemotionTransitionType } from "@/modules/remotion/utils/TransitionSelector";

export function ViralTransitionEngine({
  type,
  direction,
}: {
  type: RemotionTransitionType;
  direction: "left" | "right" | "up" | "down";
}) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const state = getViralTransitionState(frame, type, direction, width / 1080);
  const isFilmBurn = type === "film-burn";
  const isCrossZoom = type === "cross-zoom";

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          transform: state.isHorizontal ? `translateX(${state.offset}px) scale(${state.scale})` : `translateY(${state.offset}px) scale(${state.scale})`,
          opacity: state.opacity,
          filter: state.blurPx > 0 ? `blur(${state.blurPx}px)` : undefined,
          background: state.background,
        }}
      />
      {isFilmBurn ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: state.opacity,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(255,248,220,0.1) 18%, rgba(255,244,214,0.7) 42%, rgba(251,146,60,0.55) 58%, rgba(127,29,29,0.4) 72%, rgba(0,0,0,0) 100%)",
            mixBlendMode: "screen",
            transform: `translateX(${state.offset * 0.35}px) scale(${Math.max(1, state.scale)})`,
          }}
        />
      ) : null}
      {isCrossZoom ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: state.opacity,
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.28) 14%, rgba(59,130,246,0.16) 26%, rgba(15,23,42,0) 52%)",
            mixBlendMode: "screen",
            transform: `scale(${Math.max(1.04, state.scale * 1.06)})`,
          }}
        />
      ) : null}
      {state.flashOpacity > 0 && type === "flash-cut" ? (
        <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${state.flashOpacity})` }} />
      ) : null}
    </>
  );
}
