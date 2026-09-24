"use client";

import { ReactNode } from "react";
import { useCurrentFrame } from "remotion";

export function CameraShake({ children, intensity = 1 }: { children: ReactNode; intensity?: number }) {
  const frame = useCurrentFrame();
  const x = Math.sin(frame * 0.8) * 8 * intensity;
  const y = Math.cos(frame * 1.1) * 6 * intensity;
  const rotate = Math.sin(frame * 0.35) * 1.6 * intensity;
  return <div style={{ width: "100%", height: "100%", transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)` }}>{children}</div>;
}
