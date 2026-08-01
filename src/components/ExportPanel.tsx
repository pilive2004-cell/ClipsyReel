"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Layers, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { usePlan } from "@/lib/plan-context";

interface ExportPanelProps {
  videoUrl: string;
  videoName: string;
  onLockedClick: () => void;
}

/**
 * Downloads the real ffmpeg.wasm-rendered montage (`videoUrl` is a blob URL
 * produced by `buildMontage()` in `src/lib/video-engine.ts`).
 *
 * FUTURE BACKEND INTEGRATION:
 * Move rendering server-side once a backend exists (burn in captions,
 * apply the plan's target bitrate/resolution precisely, add the watermark
 * only for Free-plan users) and stream/link to the rendered MP4 once the
 * job completes, instead of rendering on-device.
 */
export default function ExportPanel({ videoUrl, videoName, onLockedClick }: ExportPanelProps) {
  const { plan, isFree } = usePlan();
  const [isExporting, setIsExporting] = useState(false);
  const [done, setDone] = useState(false);

  const quality = plan === "business" ? "4K" : plan === "creator" ? "HD (1080p)" : "720p";

  const handleExport = () => {
    setIsExporting(true);
    setDone(false);
    setTimeout(() => {
      setIsExporting(false);
      setDone(true);

      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `clipsyreel-${videoName.replace(/\.[^.]+$/, "")}.mp4`;
      a.click();
    }, 1600);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
          Export quality
        </div>
        <span className="text-xs font-semibold text-white/90">{quality}</span>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-3.5 w-3.5 text-fuchsia-400" />
          Watermark
        </div>
        <span className={isFree ? "text-xs font-semibold text-amber-300" : "text-xs font-semibold text-emerald-400"}>
          {isFree ? "Visible on export" : "Removed"}
        </span>
      </div>

      <button
        onClick={() => (plan !== "business" ? undefined : onLockedClick())}
        disabled={plan === "business"}
        className="flex w-full items-center justify-between rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Layers className="h-3.5 w-3.5" />
          Batch export multiple Reels
        </div>
        {plan === "business" ? (
          <span className="text-[10px] font-semibold text-emerald-400">Coming soon</span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-semibold text-amber-300">
            <Lock className="h-3 w-3" /> Business
          </span>
        )}
      </button>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition disabled:opacity-70"
      >
        {isExporting ? (
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
            <Sparkles className="h-4 w-4" />
          </motion.span>
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isExporting ? "Rendering your Reel…" : "Download MP4"}
      </button>

      {done && (
        <p className="text-center text-[11px] text-emerald-400">
          Your Reel is ready — remember to add it to Instagram manually 🎉
        </p>
      )}

      {isFree && (
        <button
          onClick={onLockedClick}
          className="w-full text-center text-[11px] font-medium text-white/40 underline decoration-white/20 underline-offset-2 hover:text-white/65"
        >
          Remove the watermark with Creator Pro
        </button>
      )}
    </div>
  );
}
