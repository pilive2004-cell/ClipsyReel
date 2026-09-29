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
  direction: "left" | "right" | "up" | "down",
  viewportScale = 1
) {
  const progress = lerp(frame, 0, 16, 0, 1);
  const isFilmBurn = type === "film-burn";
  const isCrossZoom = type === "cross-zoom";
  const isHorizontal = direction === "left" || direction === "right";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const offset = isCrossZoom ? (1 - progress) * sign * 72 * viewportScale : (1 - progress) * sign * 180 * viewportScale;
  const flashOpacity =
    type === "flash-cut"
      ? progress <= 0.25
        ? lerp(progress, 0, 0.25, 0, 0.9)
        : lerp(progress, 0.25, 1, 0.9, 0)
      : 0;
  const blurPx =
    isCrossZoom
      ? (10 + (1 - progress) * 22) * viewportScale
      : ["motion-blur", "directional-blur", "whip-pan", "speed-ramp"].includes(type)
        ? (1 - progress) * 26 * viewportScale
        : isFilmBurn
          ? (1 - progress) * 10 * viewportScale
          : 0;
  const scale =
    isCrossZoom
      ? 1.08 + (1 - progress) * 0.24
      : ["fast-zoom", "dynamic-scale"].includes(type)
        ? 1 + (1 - progress) * 0.18
        : isFilmBurn
          ? 1.02 + (1 - progress) * 0.08
          : 1;
  const opacity =
    progress <= 0.12
      ? lerp(progress, 0, 0.12, 0, 1)
      : progress <= 0.82
        ? 1
        : lerp(progress, 0.82, 1, 1, 0);
  const background =
    isFilmBurn
      ? "linear-gradient(120deg, rgba(255,236,179,0.94), rgba(251,146,60,0.62), rgba(127,29,29,0.28))"
      : isCrossZoom
        ? "radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, rgba(56,189,248,0.18) 26%, rgba(15,23,42,0.05) 62%, rgba(15,23,42,0.0) 100%)"
    : type === "glitch"
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
