"use client";

import type { RemotionTransitionType } from "@/modules/remotion/utils/TransitionSelector";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(input: number, inputStart: number, inputEnd: number, outputStart: number, outputEnd: number) {
  if (inputEnd === inputStart) return outputEnd;
  const progress = clamp01((input - inputStart) / (inputEnd - inputStart));
  return outputStart + (outputEnd - outputStart) * progress;
}

export function getHookTextPanelState(frame: number) {
  return {
    translateX: lerp(frame, 0, 16, 70, 0),
    opacity:
      frame <= 8
        ? lerp(frame, 0, 8, 0, 0.4)
        : frame <= 16
          ? lerp(frame, 8, 16, 0.4, 1)
          : 1,
    scale:
      frame <= 12
        ? lerp(frame, 0, 12, 0.96, 1.02)
        : frame <= 18
          ? lerp(frame, 12, 18, 1.02, 1)
          : 1,
  };
}

export function getActionTitleCardState(frame: number) {
  return {
    translateY: frame <= 12 ? lerp(frame, 0, 12, 28, 0) : 0,
    opacity: frame <= 10 ? lerp(frame, 0, 10, 0, 1) : 1,
  };
}

export function getViralTransitionState(
  frame: number,
  type: RemotionTransitionType,
  direction: "left" | "right" | "up" | "down"
) {
  const progress = lerp(frame, 0, 16, 0, 1);
  const isHorizontal = direction === "left" || direction === "right";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const offset = (1 - progress) * sign * 180;
  const flashOpacity =
    type === "flash-cut"
      ? progress <= 0.25
        ? lerp(progress, 0, 0.25, 0, 0.9)
        : lerp(progress, 0.25, 1, 0.9, 0)
      : 0;
  const blurPx =
    ["motion-blur", "directional-blur", "whip-pan", "speed-ramp"].includes(type) ? (1 - progress) * 26 : 0;
  const scale = ["fast-zoom", "dynamic-scale"].includes(type) ? 1 + (1 - progress) * 0.18 : 1;
  const opacity =
    progress <= 0.12
      ? lerp(progress, 0, 0.12, 0, 1)
      : progress <= 0.82
        ? 1
        : lerp(progress, 0.82, 1, 1, 0);
  const background =
    type === "glitch"
      ? "linear-gradient(115deg, rgba(244,114,182,0.18), rgba(255,255,255,0.05), rgba(34,211,238,0.18))"
      : "linear-gradient(120deg, rgba(15,23,42,0.18), rgba(245,158,11,0.14), rgba(255,255,255,0.08))";

  return {
    isHorizontal,
    offset,
    flashOpacity,
    blurPx,
    scale,
    opacity,
    background,
  };
}
