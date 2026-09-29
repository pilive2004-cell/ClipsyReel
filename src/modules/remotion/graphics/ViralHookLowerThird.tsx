"use client";

import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
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
  const { width, height } = useVideoConfig();
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
      barWidth: Math.round(width * 0.9074074074),
      barHeight: Math.round(height * 0.04375),
      barGap: Math.max(6, Math.round(height * 0.0041666667)),
      paddingX: Math.round(width * 0.0240740741),
      fontSize: Math.round((text.trim().length > 18 ? 40 : 48) * (width / 1080)),
    };

    if (!measurer) {
      return fallback;
    }

    return resolveViralHookLowerThirdLayout(text, measurer, Math.round(width * 0.9333333333), width / 1080, height / 1920);
  }, [height, measurer, text, width]);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: `0 0 ${Math.round(height * 0.1145833333)}px ${Math.round(width * 0.05)}px`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: layout.barGap,
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
