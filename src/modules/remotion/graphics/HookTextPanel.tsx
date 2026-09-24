"use client";

import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getHookTextPanelState } from "@/modules/remotion/motion/viralMotion";

export function HookTextPanel({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const state = getHookTextPanelState(frame);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        padding: "32px 32px 18px 32px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(62vw, 620px)",
          display: "flex",
          alignItems: "stretch",
          opacity: state.opacity,
          transform: `translateX(${state.translateX}px) scale(${state.scale})`,
          filter: "drop-shadow(0 24px 40px rgba(15, 23, 42, 0.42))",
        }}
      >
        <div
          style={{
            width: 6,
            borderRadius: 999,
            background: "linear-gradient(180deg, #7dd3fc 0%, #a78bfa 35%, #f97316 100%)",
            boxShadow: "0 0 24px rgba(168, 85, 247, 0.42)",
          }}
        />

        <div
          style={{
            flex: 1,
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.82), rgba(15, 118, 110, 0.18) 34%, rgba(59, 130, 246, 0.14) 100%)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderLeft: "none",
            borderRadius: "0 22px 22px 0",
            padding: "12px 18px 14px 18px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 96,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "rgba(125, 211, 252, 0.9)",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Hook
          </div>

          <div
            style={{
              fontSize: 28,
              lineHeight: 1.08,
              fontWeight: 800,
              color: "rgba(255,255,255,0.97)",
              letterSpacing: "0.03em",
              textShadow: "0 10px 22px rgba(15, 23, 42, 0.58)",
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
