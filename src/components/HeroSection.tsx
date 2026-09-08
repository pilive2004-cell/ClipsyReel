"use client";

import { motion } from "framer-motion";
import { Film, Sparkles, Zap } from "lucide-react";
import { useLocale } from "@/lib/i18n";

export default function HeroSection() {
  const { copy } = useLocale();

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
          {copy.hero.badge}
        </span>

        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {copy.hero.titleTop}
          <br />
          <span className="brand-gradient-text">{copy.hero.titleBottom}</span>
        </h1>

        <p className="max-w-xs text-sm leading-relaxed text-white/60 sm:max-w-sm">
          {copy.hero.description}
        </p>

        <div className="mt-1 flex items-center gap-4 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-400" /> {copy.hero.fast}
          </span>
          <span className="flex items-center gap-1">
            <Film className="h-3 w-3 text-fuchsia-400" /> {copy.hero.ready}
          </span>
          <span>{copy.hero.noSkills}</span>
        </div>
      </motion.div>
    </section>
  );
}
