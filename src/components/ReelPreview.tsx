"use client";

import { motion } from "framer-motion";
import { Clock3, Film, TrendingUp } from "lucide-react";
import { BestMoment, ReelStyle } from "@/types";
import { STYLES } from "@/data/mock";

interface ReelPreviewProps {
  videoUrl: string;
  style: ReelStyle;
  hookText: string;
  overallScore: number;
  bestMoments: BestMoment[];
  watermark: boolean;
  /** Real montage stats from ffmpeg.wasm rendering (clip count / final duration). */
  montageInfo?: { clipCount: number; durationSeconds: number };
}

export default function ReelPreview({ videoUrl, style, hookText, overallScore, bestMoments, watermark, montageInfo }: ReelPreviewProps) {
  const styleDef = STYLES.find((s) => s.id === style)!;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl shadow-black/50">
        <video src={videoUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />

        {/* Subtle style color-grade on top of the real ffmpeg.wasm cut (which already applies the style's cuts/zoom/transitions) */}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${styleDef.gradient} mix-blend-overlay opacity-15`} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/20" />

        {/* Top badges */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
            <TrendingUp className="h-3 w-3 text-emerald-400" /> {overallScore} score
          </span>
          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
            {styleDef.emoji} {styleDef.label}
          </span>
        </div>

        {/* Hook text overlay */}
        <div className="absolute inset-x-3 bottom-16">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-bold leading-snug text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
          >
            {hookText}
          </motion.p>
        </div>

        {/* Simulated timeline of detected best moments */}
        <div className="absolute inset-x-3 bottom-6 flex gap-1">
          {bestMoments.map((m) => (
            <div key={m.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full brand-gradient" style={{ width: `${m.confidence}%` }} />
            </div>
          ))}
        </div>

        {watermark && (
          <div className="absolute bottom-2 right-3 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white/70">
            ClipsyReel
          </div>
        )}
      </div>

      {montageInfo && (
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Film className="h-3 w-3" />
          Real edit · {montageInfo.clipCount} clips cross-faded · {montageInfo.durationSeconds.toFixed(1)}s
        </div>
      )}

      <div className="w-full max-w-[260px] space-y-1.5">
        {bestMoments.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-white/60">
              <Clock3 className="h-3 w-3" /> {m.timestampLabel}
            </span>
            <span className="font-semibold text-emerald-400">{m.confidence}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
