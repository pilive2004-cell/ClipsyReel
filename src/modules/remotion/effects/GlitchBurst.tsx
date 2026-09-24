"use client";

import { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";

export function GlitchBurst({ children, intensity = 1 }: { children: ReactNode; intensity?: number }) {
  const frame = useCurrentFrame();
  const offset = interpolate(frame % 6, [0, 2, 5], [0, intensity * 18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.22, transform: `translateX(${-offset}px)`, mixBlendMode: "screen", color: "#f472b6" }}>{children}</div>
      <div style={{ position: "absolute", inset: 0, opacity: 0.2, transform: `translateX(${offset}px)`, mixBlendMode: "screen", color: "#22d3ee" }}>{children}</div>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
}
