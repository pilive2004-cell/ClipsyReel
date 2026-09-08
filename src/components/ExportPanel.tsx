"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Layers, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { usePlan } from "@/lib/plan-context";
import { useLocale } from "@/lib/i18n";
import { saveVideoToDevice } from "@/lib/save-video";

interface ExportPanelProps {
  videoUrl: string;
  videoBlob: Blob | null;
  videoName: string;
  onLockedClick: () => void;
}

/**
 * Downloads the real ffmpeg.wasm-rendered montage (`videoUrl`/`videoBlob`
 * come from `buildMontage()` in `src/lib/video-engine.ts`). Uses
 * `saveVideoToDevice` so mobile users get the file saved straight to their
 * Photos/gallery app (via the native share sheet) instead of just a Files
 * download — see `src/lib/save-video.ts` for why a plain `<a download>`
 * isn't enough on its own.
 *
 * FUTURE BACKEND INTEGRATION:
 * Move rendering server-side once a backend exists (burn in captions,
 * apply the plan's target bitrate/resolution precisely, add the watermark
 * only for Free-plan users) and stream/link to the rendered MP4 once the
 * job completes, instead of rendering on-device.
 */
export default function ExportPanel({ videoUrl, videoBlob, videoName, onLockedClick }: ExportPanelProps) {
  const { plan, isFree } = usePlan();
  const { copy } = useLocale();
  const [isExporting, setIsExporting] = useState(false);
  const [done, setDone] = useState(false);

  const quality = "720p";

  const handleExport = async () => {
    // IMPORTANT: the actual save (`saveVideoToDevice` — which may call the
    // Web Share API) must run synchronously within this click handler, not
    // inside a `setTimeout`. Browsers (Safari/WebKit in particular) only
    // allow `navigator.share()` and some download paths while there's still
    // "user activation" from the click — scheduling the real work via
    // `setTimeout` (even a few ms) drops that activation, so the share
    // sheet/download silently gets blocked or no-ops. A previous version of
    // this component wrapped the save in `setTimeout(..., 1600)` purely for
    // a cosmetic spinner delay, which broke exports in exactly this way.
    setIsExporting(true);
    setDone(false);
    const filename = `clipsyreel-${videoName.replace(/\.[^.]+$/, "")}.mp4`;
    try {
      if (videoBlob) {
        await saveVideoToDevice(videoBlob, filename);
      } else {
        // Fallback for the (rare) case a montage blob isn't available — the raw uploaded clip preview.
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        await saveVideoToDevice(blob, filename);
      }
    } catch (e) {
      console.error("Export failed", e);
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setIsExporting(false);
    setDone(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
          {copy.export.quality}
        </div>
        <span className="text-xs font-semibold text-white/90">{quality}</span>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-3.5 w-3.5 text-fuchsia-400" />
          {copy.export.watermark}
        </div>
        <span className={isFree ? "text-xs font-semibold text-amber-300" : "text-xs font-semibold text-emerald-400"}>
          {isFree ? copy.export.visible : copy.export.removed}
        </span>
      </div>

      <button
        onClick={() => (plan !== "business" ? undefined : onLockedClick())}
        disabled={plan === "business"}
        className="flex w-full items-center justify-between rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Layers className="h-3.5 w-3.5" />
          {copy.export.batch}
        </div>
        {plan === "business" ? (
          <span className="text-[10px] font-semibold text-emerald-400">{copy.export.comingSoon}</span>
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
        {isExporting ? copy.export.rendering : copy.export.download}
      </button>

      {done && (
        <p className="text-center text-[11px] text-emerald-400">
          {copy.export.done}
        </p>
      )}

      {isFree && (
        <button
          onClick={onLockedClick}
          className="w-full text-center text-[11px] font-medium text-white/40 underline decoration-white/20 underline-offset-2 hover:text-white/65"
        >
          {copy.export.removeWatermark}
        </button>
      )}
    </div>
  );
}
