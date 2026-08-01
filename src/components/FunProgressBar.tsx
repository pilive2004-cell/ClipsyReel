"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Rocket, Sparkles } from "lucide-react";

interface FunProgressBarProps {
  /** 0-1 progress, or `null` while indeterminate (e.g. engine still loading). */
  progress: number | null;
  /** Rotating fun captions shown under the track — keeps a long wait feel light instead of boring. */
  messages: string[];
}

/**
 * A playful, distracting progress indicator: a little rocket flies along the
 * track following real progress (or bounces back and forth when progress is
 * indeterminate), leaving a small sparkle trail — instead of a plain boring
 * loading bar. Purely cosmetic; the actual % text below still reflects real
 * `ffmpeg.on("progress", …)` events so it stays honest.
 */
export default function FunProgressBar({ progress, messages }: FunProgressBarProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMessageIndex((i) => (i + 1) % messages.length), 2200);
    return () => clearInterval(t);
  }, [messages.length]);

  const pct = progress === null ? null : Math.round(progress * 100);
  // Keep the rocket's travel within the track (never fully overlapping the rounded caps).
  const rocketLeft = pct === null ? undefined : `calc(${Math.min(96, Math.max(4, pct))}% - 14px)`;

  return (
    <div className="w-full max-w-xs">
      <div className="relative h-8 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
        {/* Muted fill trailing behind the rocket */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-fuchsia-500/25 to-orange-400/25"
          animate={{ width: pct === null ? "100%" : `${pct}%` }}
          transition={{ ease: "easeOut", duration: 0.35 }}
        />

        {/* Little dashed "track" for a playful race-course feel */}
        <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.15)_0px,rgba(255,255,255,0.15)_6px,transparent_6px,transparent_14px)]" />

        {pct === null ? (
          // Indeterminate: rocket loops back and forth ("tourne et revient")
          <motion.div
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center"
            animate={{ left: ["4%", "88%", "4%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <RocketGlyph />
          </motion.div>
        ) : (
          <motion.div
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center"
            animate={{ left: rocketLeft }}
            transition={{ ease: "easeOut", duration: 0.4 }}
          >
            <RocketGlyph />
          </motion.div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-white/40">
        <AnimatePresence mode="wait">
          <motion.span
            key={messageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {messages[messageIndex]}
            {pct !== null && ` · ${pct}%`}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function RocketGlyph() {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      animate={{ y: [-1.5, 1.5, -1.5], rotate: [-8, 8, -8] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Exhaust flame trails behind the rocket (opposite of travel direction, i.e. on the left). */}
      <motion.div
        className="absolute -left-1 h-2.5 w-2.5 rounded-full bg-orange-400/70 blur-[3px]"
        animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.8, 1.3, 0.8] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Nose pointing right (forward, in the direction of travel across the track). */}
      <Rocket className="relative h-4 w-4 rotate-45 text-white drop-shadow-[0_0_6px_rgba(217,70,239,0.7)]" />
      <Sparkles className="absolute -bottom-1 -left-2 h-2.5 w-2.5 text-amber-300/80" />
    </motion.div>
  );
}
