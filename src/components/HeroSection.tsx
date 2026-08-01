"use client";

import { motion } from "framer-motion";
import { Film, Sparkles, Zap } from "lucide-react";

const STATS = [
  { label: "Reels created", value: "128k+" },
  { label: "Avg. time saved", value: "22 min" },
  { label: "Creators onboard", value: "6,400+" },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/5 glass-card px-5 py-7 text-center">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full brand-gradient opacity-20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex flex-col items-center gap-3"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70">
          <Sparkles className="h-3 w-3 text-fuchsia-400" />
          AI-powered Reel creation
        </span>

        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          Turn any video into a
          <br />
          <span className="brand-gradient-text">scroll-stopping Reel</span>
        </h1>

        <p className="max-w-xs text-sm leading-relaxed text-white/60 sm:max-w-sm">
          Upload your MP4, pick a style, and let ClipsyReel find the best
          moments, write your hook &amp; caption, and export a ready-to-post 9:16 Reel.
        </p>

        <div className="mt-2 grid w-full grid-cols-3 gap-2">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/5 bg-white/[0.03] px-2 py-2.5">
              <div className="text-sm font-bold sm:text-base">{s.value}</div>
              <div className="text-[10px] leading-tight text-white/50">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-1 flex items-center gap-4 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-400" /> Fast
          </span>
          <span className="flex items-center gap-1">
            <Film className="h-3 w-3 text-fuchsia-400" /> 9:16 ready
          </span>
          <span>No editing skills needed</span>
        </div>
      </motion.div>
    </section>
  );
}
