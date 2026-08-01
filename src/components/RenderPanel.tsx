"use client";

import { motion } from "framer-motion";
import { Clapperboard } from "lucide-react";
import FunProgressBar from "@/components/FunProgressBar";

interface RenderPanelProps {
  /** 0-1 progress. `null` while the ffmpeg.wasm engine itself is still downloading/booting. */
  progress: number | null;
  phaseLabel: string;
  styleLabel: string;
}

const FUN_MESSAGES = [
  "Warming up the engines 🚀",
  "Cutting your best moments ✂️",
  "Adding cinematic zoom 🔍",
  "Cross-fading your clips 🎞️",
  "Sprinkling some movie magic ✨",
  "Almost ready to launch 🎬",
];

/**
 * Shown while the real ffmpeg.wasm montage (cuts + Ken Burns zoom + transitions)
 * is being rendered in the browser. Unlike `AIAnalysisPanel` (a simulated
 * timer), the progress bar here reflects real `ffmpeg.on("progress", …)`
 * events — rendering can take anywhere from a few seconds to ~a minute
 * depending on video length and device performance, so a playful rocket +
 * rotating captions keep the wait feeling fun instead of dead time.
 */
export default function RenderPanel({ progress, phaseLabel, styleLabel }: RenderPanelProps) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 glass-card px-5 py-10 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full brand-gradient opacity-30 blur-xl"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full brand-gradient"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        >
          <Clapperboard className="h-7 w-7 text-white" />
        </motion.div>
      </div>

      <div>
        <p className="text-base font-semibold text-white/90">Editing your {styleLabel} montage…</p>
        <p className="mt-1 text-xs text-white/45">{phaseLabel}</p>
      </div>

      <FunProgressBar progress={progress} messages={FUN_MESSAGES} />

      <p className="max-w-[220px] text-[11px] leading-relaxed text-white/35">
        Real cuts, zoom and transitions are being rendered on your device — no upload to a server needed.
      </p>
    </div>
  );
}
