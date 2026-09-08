"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bike, Sparkles } from "lucide-react";

interface FunProgressBarProps {
  /** 0-1 progress, or `null` while indeterminate (e.g. engine still loading). */
  progress: number | null;
  /** Rotating fun captions shown under the track — keeps a long wait feel light instead of boring. */
  messages: string[];
}

/**
 * A playful, distracting progress indicator: a little motorcycle wheelie rides along the
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
  // Keep the bike's travel within the track (never fully overlapping the rounded caps).
  const bikeLeft = pct === null ? undefined : `calc(${Math.min(96, Math.max(4, pct))}% - 14px)`;

  return (
    <div className="w-full max-w-xs">
      <div className="relative h-8 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
        {/* Muted fill trailing behind the bike */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-fuchsia-500/25 to-orange-400/25"
          animate={{ width: pct === null ? "100%" : `${pct}%` }}
          transition={{ ease: "easeOut", duration: 0.35 }}
        />

        {/* Little dashed "track" for a playful race-course feel */}
        <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.15)_0px,rgba(255,255,255,0.15)_6px,transparent_6px,transparent_14px)]" />

        {pct === null ? (
          // Indeterminate: bike loops back and forth ("tourne et revient")
          <motion.div
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center"
            animate={{ left: ["4%", "88%", "4%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <WheelieBikeGlyph />
          </motion.div>
        ) : (
          <motion.div
            className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center"
            animate={{ left: bikeLeft }}
            transition={{ ease: "easeOut", duration: 0.4 }}
          >
            <WheelieBikeGlyph />
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

function WheelieBikeGlyph() {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      animate={{ y: [-1.2, 1.2, -1.2], rotate: [-6, 6, -6] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Flame burst behind the bike during wheelie. */}
      <motion.div
        className="absolute -left-2 top-[45%] h-2.5 w-2.5 rounded-full bg-orange-400/75 blur-[3px]"
        animate={{ opacity: [0.25, 0.95, 0.25], scale: [0.75, 1.35, 0.75] }}
        transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -left-3 top-[52%] h-2 w-2 rounded-full bg-amber-300/80 blur-[2px]"
        animate={{ opacity: [0.2, 0.7, 0.2], x: [0, -2, 0], scale: [0.7, 1.2, 0.7] }}
        transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Wheelie posture: front wheel lifted while moving right. */}
      <Bike className="relative h-4 w-4 -rotate-[18deg] text-white drop-shadow-[0_0_6px_rgba(217,70,239,0.7)]" />
      <Sparkles className="absolute -bottom-1.5 -left-1.5 h-2.5 w-2.5 text-amber-300/80" />
    </motion.div>
  );
}
