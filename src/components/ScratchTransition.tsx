"use client";

import { motion } from "framer-motion";
import { SportHookEffect, SportHookTheme } from "@/lib/sport-style";

function colorsForTheme(theme: SportHookTheme) {
  if (theme === "offroad") {
    return {
      accent: "rgba(214,193,161,0.24)",
      secondary: "rgba(108,74,40,0.18)",
    };
  }
  if (theme === "premium") {
    return {
      accent: "rgba(241,92,5,0.22)",
      secondary: "rgba(244,238,228,0.18)",
    };
  }
  return {
    accent: "rgba(241,92,5,0.24)",
    secondary: "rgba(255,255,255,0.16)",
  };
}

interface ScratchTransitionProps {
  activeKey: string;
  effect?: SportHookEffect;
  theme?: SportHookTheme;
}

export default function ScratchTransition({
  activeKey,
  effect = "scratch",
  theme = "sport",
}: ScratchTransitionProps) {
  const colors = colorsForTheme(theme);
  const fromLeft = effect === "slide-left" || effect === "terrain" || effect === "scratch";
  const fromRight = effect === "slide-right" || effect === "dust";
  const impactEffect = effect === "scratch" || effect === "terrain" || effect === "dust";

  return (
    <div key={activeKey} className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, x: fromLeft ? "-18%" : fromRight ? "18%" : 0, scaleX: effect === "scale" ? 0.86 : 1 }}
        animate={{ opacity: impactEffect ? [0.2, 0.34, 0.12] : [0.12, 0.26, 0.08], x: 0, scaleX: 1 }}
        transition={{ duration: impactEffect ? 0.34 : 0.42, ease: "easeOut" }}
        className="absolute inset-y-[12%] w-[76%] rounded-r-[8px] mix-blend-screen"
        style={{
          left: fromRight ? "24%" : "0%",
          background:
            effect === "terrain"
              ? `linear-gradient(110deg, transparent 0%, ${colors.accent} 24%, transparent 52%)`
              : `linear-gradient(90deg, ${colors.accent}, transparent 68%)`,
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: impactEffect ? [0.06, 0.3, 0.12, 0] : [0, 0.18, 0.06, 0] }}
        transition={{ duration: impactEffect ? 0.36 : 0.5, ease: "easeOut" }}
        className="absolute inset-0 mix-blend-screen"
        style={{
          background:
            effect === "dust"
              ? `radial-gradient(circle at 22% 28%, ${colors.secondary}, transparent 34%), radial-gradient(circle at 64% 52%, ${colors.accent}, transparent 28%)`
              : `radial-gradient(circle at 18% 26%, ${colors.accent}, transparent 38%)`,
        }}
      />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <motion.div
          key={`${activeKey}-${index}`}
          initial={{ opacity: 0, x: index % 2 === 0 ? -34 : 34, scaleX: effect === "scale" ? 0.85 : 1 }}
          animate={{ opacity: [0, 0.28, 0.08, 0], x: 0, scaleX: 1 }}
          transition={{ duration: 0.32 + index * 0.04, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{
            left: `${8 + index * 12}%`,
            top: `${14 + index * 11}%`,
            width: `${20 + (index % 3) * 8}%`,
            height: effect === "terrain" ? "3px" : index % 2 === 0 ? "2px" : "1px",
            background: index % 2 === 0 ? colors.secondary : "rgba(255,255,255,0.76)",
            transform: `rotate(${effect === "terrain" ? -12 : index % 2 === 0 ? -16 : 13}deg)`,
            boxShadow: "0 0 12px rgba(255,255,255,0.12)",
          }}
        />
      ))}
      {impactEffect && (
        <>
        <motion.div
          initial={{ opacity: 0.72 }}
          animate={{ opacity: [0.72, 0.06, 0] }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className="absolute inset-0"
          style={{ background: "rgba(255,255,255,0.52)", mixBlendMode: "screen" }}
        />
        <motion.div
          initial={{ opacity: 0.52, x: -12 }}
          animate={{ opacity: [0.52, 0.18, 0], x: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="absolute inset-y-[58%] left-0 right-0"
          style={{ background: "linear-gradient(90deg, rgba(225,29,46,0.5), transparent 70%)", mixBlendMode: "screen" }}
        />
        <motion.div
          initial={{ opacity: 0.42, x: 12 }}
          animate={{ opacity: [0.42, 0.14, 0], x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute inset-y-[62%] left-0 right-0"
          style={{ background: "linear-gradient(270deg, rgba(56,189,248,0.34), transparent 72%)", mixBlendMode: "screen" }}
        />
        </>
      )}
    </div>
  );
}
