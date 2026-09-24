"use client";

import { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";

export function MotionBlur({ children, intensity = 1 }: { children: ReactNode; intensity?: number }) {
  const frame = useCurrentFrame();
  const blur = interpolate(frame, [0, 10, 22], [14 * intensity, 4 * intensity, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{ width: "100%", height: "100%", filter: `blur(${blur}px)` }}>{children}</div>;
}
