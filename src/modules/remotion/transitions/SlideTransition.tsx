"use client";

import { interpolate, useCurrentFrame } from "remotion";

export function SlideTransition({ direction = "left" }: { direction?: "left" | "right" }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const offset = interpolate(progress, [0, 1], [direction === "left" ? 120 : -120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        transform: `translateX(${offset}px)`,
        opacity,
        background: "linear-gradient(120deg, rgba(15,23,42,0.15), rgba(56,189,248,0.12), rgba(168,85,247,0.18))",
      }}
    />
  );
}
