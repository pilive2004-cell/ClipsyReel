import type { CSSProperties } from "react";

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string): number {
  let state = hashSeed(seed) || 1;
  state = Math.imul(state ^ (state >>> 15), 1 | state);
  state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
  return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
}

export interface RGBGlitchTextProps {
  text: string;
  frame?: number;
  fontSize?: number | string;
  color?: string;
  fontWeight?: CSSProperties["fontWeight"];
  fontFamily?: string;
  fontStyle?: CSSProperties["fontStyle"];
  letterSpacing?: CSSProperties["letterSpacing"];
  textTransform?: CSSProperties["textTransform"];
  lineHeight?: CSSProperties["lineHeight"];
  textAlign?: CSSProperties["textAlign"];
  maxWidth?: CSSProperties["maxWidth"];
  glitchAt?: number;
  glitchDuration?: number;
  intensity?: number;
  seed?: string;
  speed?: number;
  className?: string;
}

export function RGBGlitchText({
  text,
  frame = 0,
  fontSize = 96,
  color = "#171717",
  fontWeight = 700,
  fontFamily,
  fontStyle = "normal",
  letterSpacing = "0em",
  textTransform = "none",
  lineHeight = 0.98,
  textAlign = "left",
  maxWidth = "100%",
  glitchAt = 20,
  glitchDuration = 8,
  intensity = 6,
  seed = "glitch",
  speed = 1,
  className,
}: RGBGlitchTextProps) {
  const animationFrame = Math.max(0, Math.floor(frame * speed));
  const glitchFrame = animationFrame - glitchAt;
  const glitchActive = glitchFrame >= 0 && glitchFrame < glitchDuration;
  const amplitude = glitchActive ? intensity : 0;
  const jitterX1 = (seededUnit(`${seed}:x1:${animationFrame}`) - 0.5) * amplitude * 2;
  const jitterY1 = (seededUnit(`${seed}:y1:${animationFrame}`) - 0.5) * amplitude * 0.6;
  const jitterX2 = (seededUnit(`${seed}:x2:${animationFrame}`) - 0.5) * amplitude * 2.4;
  const jitterY2 = (seededUnit(`${seed}:y2:${animationFrame}`) - 0.5) * amplitude * 0.8;
  const skewX = (seededUnit(`${seed}:skew:${animationFrame}`) - 0.5) * (glitchActive ? 10 : 0);
  const upperSlice = 18 + seededUnit(`${seed}:upper:${animationFrame}`) * 26;
  const lowerSlice = 58 + seededUnit(`${seed}:lower:${animationFrame}`) * 20;
  const baseAura = Math.max(0.28, intensity / 24);

  const baseTextStyle: CSSProperties = {
    position: "relative",
    display: "block",
    fontFamily,
    fontStyle,
    fontSize,
    fontWeight,
    letterSpacing,
    textTransform,
    lineHeight,
    textAlign,
    color,
    whiteSpace: "pre-wrap",
    textShadow: glitchActive
      ? `0 0 26px rgba(255,255,255,0.24), 0 0 42px rgba(34,211,238,${(baseAura * 0.72).toFixed(2)}), 0 0 52px rgba(244,114,182,${(baseAura * 0.66).toFixed(2)})`
      : `0 8px 26px rgba(0,0,0,0.42), 3px 0 0 rgba(34,211,238,${(baseAura * 0.42).toFixed(2)}), -3px 0 0 rgba(244,114,182,${(baseAura * 0.38).toFixed(2)})`,
  };

  const overlayStyle: CSSProperties = {
    ...baseTextStyle,
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: glitchActive ? 0.98 : 0.18,
    mixBlendMode: "screen",
  };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        maxWidth,
        transform: glitchActive ? `skewX(${skewX.toFixed(2)}deg)` : undefined,
      }}
    >
      <span style={baseTextStyle}>{text}</span>
      <span
        aria-hidden="true"
        style={{
          ...overlayStyle,
          color: "#22d3ee",
          transform: `translate(${(jitterX1 + 2.5).toFixed(2)}px, ${(jitterY1 - 0.8).toFixed(2)}px)`,
          clipPath: `polygon(0 0, 100% 0, 100% ${upperSlice.toFixed(2)}%, 0 ${Math.max(0, upperSlice - 12).toFixed(2)}%)`,
        }}
      >
        {text}
      </span>
      <span
        aria-hidden="true"
        style={{
          ...overlayStyle,
          color: "#f472b6",
          transform: `translate(${(jitterX2 - 2.5).toFixed(2)}px, ${(jitterY2 + 0.8).toFixed(2)}px)`,
          clipPath: `polygon(0 ${lowerSlice.toFixed(2)}%, 100% ${Math.max(0, lowerSlice - 10).toFixed(2)}%, 100% 100%, 0 100%)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
