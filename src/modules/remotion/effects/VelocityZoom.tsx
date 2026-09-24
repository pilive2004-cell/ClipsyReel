"use client";

import { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";

export function VelocityZoom({ children, intensity = 1 }: { children: ReactNode; intensity?: number }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 18, 42], [1, 1 + intensity * 0.08, 1 + intensity * 0.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{ width: "100%", height: "100%", transform: `scale(${scale})` }}>{children}</div>;
}
