"use client";

import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  getViralHookLowerThirdState,
  resolveViralHookLowerThirdLayout,
} from "@/modules/remotion/graphics/viral-hook-lower-third";

export function ViralHookLowerThird({
  text,
  durationInFrames,
}: {
  text: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const state = getViralHookLowerThirdState(frame, durationInFrames);
  const measurer = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    return canvas.getContext("2d");
  }, []);
  const layout = useMemo(() => {
    const fallback = {
      primary: text.trim(),
      secondary: "",
      barWidth: 980,
      barHeight: 84,
      barGap: 8,
      paddingX: 26,
      fontSize: text.trim().length > 18 ? 40 : 48,
    };

    if (!measurer) {
      return fallback;
    }

    return resolveViralHookLowerThirdLayout(text, measurer, 1008);
  }, [measurer, text]);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: "0 0 220px 54px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
          opacity: state.opacity,
          transform: `translateX(${state.translateX}px)`,
          filter: "drop-shadow(0 24px 40px rgba(15, 23, 42, 0.42))",
        }}
      >
        <div
          style={{
            clipPath: `inset(0 ${(1 - state.topReveal) * 100}% 0 0)`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              minHeight: layout.barHeight,
              boxSizing: "border-box",
              width: layout.barWidth,
              maxWidth: "95vw",
              padding: `0 ${layout.paddingX}px`,
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontSize: layout.fontSize,
              fontWeight: 800,
              letterSpacing: 0.4,
              lineHeight: 1.02,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            {layout.primary}
          </div>
        </div>
        {layout.secondary ? (
          <div
            style={{
              clipPath: `inset(0 ${(1 - state.bottomReveal) * 100}% 0 0)`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: layout.barHeight,
                boxSizing: "border-box",
                width: layout.barWidth,
                maxWidth: "95vw",
                padding: `0 ${layout.paddingX}px`,
                backgroundColor: "#18181b",
                color: "#ffffff",
                fontSize: layout.fontSize,
                fontWeight: 800,
                letterSpacing: 0.4,
                lineHeight: 1.02,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              {layout.secondary}
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
