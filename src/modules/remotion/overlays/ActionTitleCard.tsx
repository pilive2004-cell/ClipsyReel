"use client";

import { useCurrentFrame, useVideoConfig } from "remotion";
import { RGBGlitchText } from "@/components/remocn/rgb-glitch-text";
import {
  resolveReelTitleColorValue,
  resolveReelTitleFontFamily,
  resolveReelTitleFontStyle,
  resolveReelTitleFontWeight,
  resolveReelTitleLetterSpacing,
  resolveReelTitleSizeScale,
  resolveReelTitleTextTransform,
} from "@/lib/reel-title-style";
import type { ViralRemotionTitleStyle } from "@/modules/remotion/render-contract";
import { getActionTitleCardState } from "@/modules/remotion/motion/viralMotion";

export function ActionTitleCard({
  title,
  titleStyle,
}: {
  title: string;
  titleStyle?: ViralRemotionTitleStyle | null;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const state = getActionTitleCardState(frame);
  const titleColor = titleStyle ? resolveReelTitleColorValue(titleStyle.color) : "#ffffff";
  const fontFamily = resolveReelTitleFontFamily(titleStyle?.font ?? "bold");
  const fontStyle = resolveReelTitleFontStyle(titleStyle?.font ?? "bold");
  const fontWeight = resolveReelTitleFontWeight(titleStyle?.font ?? "bold");
  const letterSpacing = resolveReelTitleLetterSpacing(titleStyle?.font ?? "bold");
  const textTransform = resolveReelTitleTextTransform(titleStyle?.font ?? "bold");
  const fontSize = Math.round(width * resolveReelTitleSizeScale(titleStyle?.size ?? "md"));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: Math.round(height * 0.1875),
        opacity: state.opacity,
        transform: `translateY(${state.translateY}px)`,
        pointerEvents: "none",
      }}
    >
      <RGBGlitchText
        text={title}
        frame={frame}
        fontSize={fontSize}
        color={titleColor}
        fontFamily={fontFamily}
        fontStyle={fontStyle}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
        textTransform={textTransform}
        textAlign="center"
        glitchAt={3}
        glitchDuration={14}
        intensity={14}
        seed={title}
        speed={1.15}
        maxWidth={Math.round(width * 0.8333333333)}
      />
    </div>
  );
}
