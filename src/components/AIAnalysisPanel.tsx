"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { ANALYSIS_STEPS } from "@/data/mock";
import { analyzeAllVideos } from "@/lib/video-analysis";
import { BestMoment, UploadedVideo } from "@/types";

interface AIAnalysisPanelProps {
  videos: UploadedVideo[];
  onComplete: (bestMoments: BestMoment[] | null) => void;
}

/**
 * Drives the "analyzing…" UI while a *real*, in-browser frame analysis runs
 * in the background (see `src/lib/video-analysis.ts`): motion, sharpness and
 * exposure are scored per sampled frame to find each video's genuine best
 * moments, instead of picking random/evenly-spaced timestamps.
 *
 * The step list below is still a friendly narrated progress display (real
 * frame scoring doesn't map 1:1 to these labels), but the underlying
 * progress bar and completion are driven by the real analysis job — a short
 * clip finishes fast, a longer one takes longer, matching actual work done.
 *
 * `onComplete` receives the real detected moments, or `null` if analysis
 * failed (e.g. an unsupported codec) so the caller can fall back to mock
 * moments instead.
 *
 * FUTURE BACKEND INTEGRATION: replace the internal `analyzeAllVideos` call
 * with a real API call / job polling once a backend analysis pipeline
 * exists (see comments in `video-analysis.ts`).
 */
export default function AIAnalysisPanel({ videos, onComplete }: AIAnalysisPanelProps) {
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    const MIN_VISIBLE_MS = 1800; // keep the reveal feeling substantial even on tiny clips

    (async () => {
      let moments: BestMoment[] | null = null;
      try {
        moments = await analyzeAllVideos(
          videos.map((v) => ({ file: v.file, durationSeconds: v.durationSeconds })),
          (ratio) => {
            if (!cancelled) setProgress(ratio);
          }
        );
      } catch (e) {
        console.error("Real video analysis failed, falling back to mock moments", e);
        moments = null;
      }
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setProgress(1);
      setTimeout(() => {
        if (!cancelled) onCompleteRef.current(moments);
      }, remaining);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIndex = Math.min(ANALYSIS_STEPS.length - 1, Math.floor(progress * ANALYSIS_STEPS.length));
  const progressPct = Math.round(progress * 100);

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
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-7 w-7 text-white" />
        </motion.div>
      </div>

      <div>
        <p className="text-base font-semibold text-white/90">Analyzing your video{videos.length > 1 ? "s" : ""}…</p>
        <p className="mt-1 text-xs text-white/45">Scanning real frames for motion, sharpness & exposure</p>
      </div>

      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full brand-gradient"
            animate={{ width: `${progressPct}%` }}
            transition={{ ease: "easeOut", duration: 0.3 }}
          />
        </div>
      </div>

      <ul className="w-full max-w-xs space-y-2.5 text-left">
        {ANALYSIS_STEPS.map((step, i) => {
          const isDone = i < stepIndex;
          const isActive = i === stepIndex;
          return (
            <li
              key={step}
              className={
                "flex items-center gap-2.5 text-xs transition " +
                (isDone ? "text-white/80" : isActive ? "text-white" : "text-white/30")
              }
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-fuchsia-400" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/15" />
              )}
              {step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
