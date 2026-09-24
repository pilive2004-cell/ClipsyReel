"use client";

import { ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export function PunchZoom({ children, intensity = 1 }: { children: ReactNode; intensity?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const punch = spring({ fps, frame, config: { damping: 10, stiffness: 140 } });
  const scale = interpolate(punch, [0, 1], [1, 1 + intensity * 0.14]);
  return <div style={{ width: "100%", height: "100%", transform: `scale(${scale})` }}>{children}</div>;
}
