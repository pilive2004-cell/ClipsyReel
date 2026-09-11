"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { analyzeAllVideos, estimateAnalysisBudgetMs } from "@/lib/video-analysis";
import { BestMoment, UploadedVideo } from "@/types";
import { useLocale } from "@/lib/i18n";

interface AIAnalysisPanelProps {
  videos: UploadedVideo[];
  onComplete: (bestMoments: BestMoment[] | null) => void;
  /** Imported GPX route points (if any) — feeds the "GPX Context" signal in the best-moment scoring formula. */
  gpxPoints?: { lat: number; lng: number }[] | null;
}

export default function AIAnalysisPanel({ videos, onComplete, gpxPoints }: AIAnalysisPanelProps) {
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const { copy } = useLocale();
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let watchdogTimer: number | null = null;
    let finishTimer: number | null = null;
    const startedAt = Date.now();
    const MIN_VISIBLE_MS = 1800;
    const ANALYSIS_TIMEOUT_MS = estimateAnalysisBudgetMs(videos);
    let latestRealRatio = 0;
    // If the real (in-browser ML) analysis doesn't finish before the
    // timeout, we move on with fallback moments — but without this signal
    // the analysis loop kept running unattended in the background,
    // continuing to seek/decode/redraw video frames and compete with the
    // subsequent render step for CPU, memory, and file-handle resources.
    // That contention was a likely contributor to sporadic
    // "NotReadableError" failures when the render step tried to read the
    // same source file shortly after a timed-out analysis.
    const abortController = new AbortController();

    const heartbeat = () => {
      const elapsed = Date.now() - startedAt;
      const optimistic = Math.min(0.92, elapsed / 18000);
      setProgress((prev) => Math.max(prev, latestRealRatio, optimistic));
    };
    heartbeat();
    watchdogTimer = window.setInterval(heartbeat, 300);

    (async () => {
      let moments: BestMoment[] | null = null;
      let timedOut = false;
      let timeoutId: number | null = null;
      try {
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          abortController.abort();
        }, ANALYSIS_TIMEOUT_MS);
        moments = await analyzeAllVideos(
          videos.map((v) => ({ file: v.file, durationSeconds: v.durationSeconds })),
          (ratio) => {
            latestRealRatio = Math.max(latestRealRatio, ratio);
            if (!cancelled) setProgress((prev) => Math.max(prev, ratio));
          },
          gpxPoints,
          abortController.signal
        );
      } catch (e) {
        console.warn("Real video analysis failed, falling back to mock moments", e);
        moments = null;
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        if (watchdogTimer !== null) window.clearInterval(watchdogTimer);
      }
      if (timedOut) {
        console.warn("Real analysis exceeded its time budget, using partial real moments where available", {
          timeoutMs: ANALYSIS_TIMEOUT_MS,
          returnedMoments: moments?.length ?? 0,
        });
      }
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setProgress(1);
      finishTimer = window.setTimeout(() => {
        if (!cancelled) onCompleteRef.current(moments);
      }, remaining);
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      if (watchdogTimer !== null) window.clearInterval(watchdogTimer);
      if (finishTimer !== null) window.clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analysisSteps = copy.analysisSteps;
  const stepIndex = Math.min(analysisSteps.length - 1, Math.floor(progress * analysisSteps.length));
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
        <p className="text-base font-semibold text-white/90">{copy.analysis.title}…</p>
        <p className="mt-1 text-xs text-white/45">{copy.analysis.description}</p>
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
        {analysisSteps.map((step, i) => {
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
