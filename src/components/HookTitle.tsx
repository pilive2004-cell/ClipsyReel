"use client";

import { motion } from "framer-motion";
import { resolveSportHookPalette, SportHookBeat } from "@/lib/sport-style";

function fontClassForHook(font: SportHookBeat["font"]) {
  if (font === "classic") return "font-serif";
  if (font === "modern") return "font-sans tracking-wide";
  if (font === "bold") return "font-sans font-black tracking-tight";
  if (font === "minimal") return "font-sans font-light tracking-[0.12em]";
  if (font === "handwritten") return "font-serif italic tracking-[0.02em]";
  if (font === "elegant") return "font-serif font-medium italic tracking-[0.05em]";
  if (font === "impact") return "font-sans font-extrabold uppercase tracking-tight";
  if (font === "mono") return "font-mono tracking-[0.06em]";
  if (font === "rounded") return "font-sans font-semibold tracking-[0.04em]";
  return "font-serif italic tracking-[0.08em]";
}

function sizeClassForHook(size: SportHookBeat["size"]) {
  if (size === "sm") return "text-[clamp(15px,4.2vw,21px)] leading-[0.98]";
  if (size === "lg") return "text-[clamp(19px,5vw,25px)] leading-[0.94]";
  return "text-[clamp(17px,4.6vw,23px)] leading-[0.96]";
}

function splitEmphasisTitle(title: string) {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { prefix: title.trim(), accent: "" };
  return { prefix: parts.slice(0, -1).join(" "), accent: parts.at(-1) ?? "" };
}

interface HookTitleProps {
  beats: SportHookBeat[];
  activeIndex: number | null;
}

export default function HookTitle({ beats, activeIndex }: HookTitleProps) {
  if (activeIndex === null || !beats[activeIndex]) return null;
  const beat = beats[activeIndex];
  const palette = resolveSportHookPalette(beat.theme, beat.color);
  const { prefix, accent } = splitEmphasisTitle(beat.title);
  const alignedRight = beat.align === "right";
  const hasLabel = Boolean(beat.label?.trim());
  const hasSubtitle = Boolean(beat.subtitle?.trim());
  const fontClass = fontClassForHook(beat.font);
  const sizeClass = sizeClassForHook(beat.size);

  return (
    <div className={`pointer-events-none absolute inset-x-3 top-[68.5%] z-20 flex ${alignedRight ? "justify-end" : "justify-start"}`}>
      <motion.div
        key={`${activeIndex}-${beat.title}-${beat.subtitle}`}
        initial={{ opacity: 0, x: alignedRight ? -36 : 36, scale: 0.972, rotate: alignedRight ? 0.5 : -0.5 }}
        animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`relative flex w-[73%] max-w-[308px] flex-col ${alignedRight ? "items-end text-right" : "items-start text-left"}`}
        style={{ textShadow: "0 10px 24px rgba(0,0,0,0.44)" }}
      >
        {hasLabel && (
          <motion.div
            initial={{ opacity: 0, x: alignedRight ? 14 : -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: 0.08 }}
            className={`relative inline-flex items-center gap-2 px-2.5 py-1 ${alignedRight ? "ml-auto" : ""}`}
            style={{ backgroundColor: palette.labelFill }}
          >
            <div
              className={`absolute top-0 h-full w-7 ${alignedRight ? "-left-5 skew-x-[22deg]" : "-right-5 -skew-x-[22deg]"}`}
              style={{ backgroundColor: palette.labelFill }}
            />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: palette.labelText }}>
              {beat.label}
            </span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, x: alignedRight ? -28 : 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.54, delay: 0.14 }}
          className={`relative mt-1.5 border px-2.5 py-1.5 ${alignedRight ? "ml-auto" : ""}`}
          style={{
            backgroundColor: palette.mainFill,
            borderColor: palette.outline,
            boxShadow: `0 16px 28px rgba(0,0,0,0.26), inset 0 0 0 1px ${palette.outline}`,
            width: "min(100%, 19rem)",
          }}
        >
          <div className={`absolute top-0 h-full w-8 ${alignedRight ? "-right-6 skew-x-[-24deg]" : "-left-6 skew-x-[24deg]"}`} style={{ backgroundColor: palette.mainFill }} />
          <div className={`absolute inset-y-0 ${alignedRight ? "left-0" : "right-0"} w-1`} style={{ backgroundColor: palette.accent }} />
          <div className={`absolute top-0 h-1 w-[52%] ${alignedRight ? "right-0" : "left-0"}`} style={{ backgroundColor: palette.accent }} />
          <div className={`${alignedRight ? "pr-2" : "pl-2"}`}>
            <motion.p
              initial={{ opacity: 0, scaleX: 0.92 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.28, delay: 0.2 }}
              className={`${fontClass} ${sizeClass}`}
              style={{ color: palette.mainText }}
            >
              {prefix}
              {accent ? <span style={{ color: palette.accent }}> {accent}</span> : null}
            </motion.p>
          </div>
        </motion.div>

        {hasSubtitle && (
          <motion.div
            initial={{ opacity: 0, x: alignedRight ? -12 : 12, scaleX: 0.96 }}
            animate={{ opacity: 1, x: 0, scaleX: 1 }}
            transition={{ duration: 0.3, delay: 0.21 }}
            className={`relative mt-1.5 inline-flex max-w-[96%] items-center border px-2.5 py-1 ${alignedRight ? "ml-auto" : ""}`}
            style={{
              backgroundColor: `${palette.subtitleFill}cc`,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <div className={`absolute ${alignedRight ? "-left-4" : "-right-4"} top-1/2 h-[2px] w-4 -translate-y-1/2`} style={{ backgroundColor: palette.accent }} />
            <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: palette.subtitleText }}>
              {beat.subtitle}
            </span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
