"use client";

import { useCurrentFrame } from "remotion";
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
  const state = getViralTransitionState(frame, type, direction);

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
      {state.flashOpacity > 0 ? <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${state.flashOpacity})` }} /> : null}
    </>
  );
}
