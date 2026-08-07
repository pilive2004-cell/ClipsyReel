"use client";

import { useState } from "react";
import { Clapperboard, Download, Sparkles } from "lucide-react";
import { BestMoment, ReelStyle, UploadedVideo } from "@/types";
import { STYLES } from "@/data/mock";
import { buildMontage, qualityForPlan } from "@/lib/video-engine";
import { usePlan } from "@/lib/plan-context";
import FunProgressBar from "@/components/FunProgressBar";

interface StoryPanelProps {
  videos: UploadedVideo[];
  style: ReelStyle;
  bestMoments: BestMoment[];
  watermark: boolean;
}

const MAX_STORY_SECONDS = 60;

const FUN_MESSAGES = ["Sampling your whole story 📖", "Cross-fading clips 🎞️", "Adding cinematic zoom 🔍", "Wrapping up your Story ✨"];

/**
 * Generates a longer-form Instagram Story cut (up to the current 60s IG
 * limit) sampled across *all* uploaded videos — as opposed to the short
 * Reel, which only uses the AI-detected best moments. Same style recipe
 * (cuts, Ken Burns zoom, randomized transitions) is reused via
 * `buildMontage(mode: "story")`.
 */
export default function StoryPanel({ videos, style, bestMoments, watermark }: StoryPanelProps) {
  const { plan } = usePlan();
  const [status, setStatus] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; durationSeconds: number; clipCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const styleDef = STYLES.find((s) => s.id === style)!;
  const totalDuration = videos.reduce((sum, v) => sum + v.durationSeconds, 0);
  const cappedTarget = Math.min(MAX_STORY_SECONDS, Math.max(totalDuration, 4));

  const handleCreate = async () => {
    setStatus("rendering");
    setProgress(null);
    setError(null);
    try {
      const montage = await buildMontage({
        files: videos.map((v) => v.file),
        videoDurations: videos.map((v) => v.durationSeconds),
        style,
        mode: "story",
        bestMoments,
        maxStorySeconds: MAX_STORY_SECONDS,
        quality: qualityForPlan(),
        watermark,
        onProgress: (ratio) => setProgress(ratio),
      });
      setResult(montage);
      setStatus("done");
    } catch (e) {
      console.error(e);
      setError("Couldn't render the Story on this device. Try shorter videos.");
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `clipsyreel-${videos[0]?.name.replace(/\.[^.]+$/, "") ?? "reel"}-story.mp4`;
    a.click();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
            <Clapperboard className="h-4 w-4 text-fuchsia-400" /> Instagram Story cut
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            A longer {styleDef.label.toLowerCase()}-style edit sampled across{" "}
            {videos.length > 1 ? `all ${videos.length} of your clips` : "your whole video"}, capped at {MAX_STORY_SECONDS}s
            (Instagram&apos;s Story limit). Target length: ~{cappedTarget.toFixed(0)}s.
          </p>
        </div>
      </div>

      {status === "idle" || status === "error" ? (
        <button
          onClick={handleCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.08]"
        >
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" /> Create Story version
        </button>
      ) : null}

      {error && <p className="text-[11px] text-rose-400">{error}</p>}

      {status === "rendering" && (
        <div className="space-y-1 rounded-xl bg-black/20 px-3 py-3">
          <FunProgressBar progress={progress} messages={FUN_MESSAGES} />
        </div>
      )}

      {status === "done" && result && (
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video src={result.url} className="h-full w-full object-cover" muted loop autoPlay playsInline />
            {/* No CSS overlay here — the watermark badge (Free plan) is already burned into the rendered MP4 by buildMontage() */}
          </div>
          <p className="text-center text-[11px] text-white/40">
            {result.clipCount} clips · {result.durationSeconds.toFixed(1)}s
          </p>
          <button
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/25"
          >
            <Download className="h-3.5 w-3.5" /> Download Story MP4
          </button>
          <button onClick={handleCreate} className="w-full text-center text-[11px] font-medium text-white/40 hover:text-white/65">
            Re-generate
          </button>
        </div>
      )}
      {plan === "free" && status === "idle" && (
        <p className="text-center text-[10px] text-white/30">Uses the same weekly Reel credit as your main export.</p>
      )}
    </div>
  );
}
