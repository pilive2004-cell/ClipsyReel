"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Film } from "lucide-react";
import { BestMoment, ReelStyle } from "@/types";
import { STYLES } from "@/data/mock";

interface ReelPreviewProps {
  videoUrl: string;
  videoBlob?: Blob;
  style: ReelStyle;
  hookText: string;
  bestMoments: BestMoment[];
  watermark: boolean;
  overlayTexts?: string[];
  introDurationSeconds?: number;
  outroDurationSeconds?: number;
  /** Real montage stats from ffmpeg.wasm rendering (clip count / final duration). */
  montageInfo?: { clipCount: number; durationSeconds: number };
}

export default function ReelPreview({
  videoUrl,
  videoBlob,
  style,
  hookText,
  bestMoments,
  watermark,
  overlayTexts = [],
  introDurationSeconds = 0,
  outroDurationSeconds = 0,
  montageInfo,
}: ReelPreviewProps) {
  const styleDef = STYLES.find((s) => s.id === style)!;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [fallbackState, setFallbackState] = useState<{ source: string; url: string } | null>(null);
  const [readySource, setReadySource] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<string | null>(null);
  const [activeOverlayIndex, setActiveOverlayIndex] = useState<number | null>(null);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const effectiveVideoUrl = useMemo(() => (fallbackState?.source === videoUrl ? fallbackState.url : videoUrl), [fallbackState, videoUrl]);
  const loadState = errorSource === effectiveVideoUrl ? "error" : readySource === effectiveVideoUrl ? "ready" : "loading";
  const montageWindow = useMemo(() => {
    const totalDuration = Math.max(montageInfo?.durationSeconds ?? 0, 0);
    const start = Math.max(0, introDurationSeconds);
    const end = totalDuration > 0 ? Math.max(start, totalDuration - outroDurationSeconds) : Number.POSITIVE_INFINITY;
    return { start, end };
  }, [introDurationSeconds, montageInfo?.durationSeconds, outroDurationSeconds]);
  const showPreviewChrome = currentTimeSeconds >= montageWindow.start && currentTimeSeconds < montageWindow.end;
  const overlayWindows = useMemo(() => {
    if (overlayTexts.length === 0) return [];
    const totalDuration = Math.max(montageInfo?.durationSeconds ?? 0, 1);
    const startBoundary = Math.max(0.35, introDurationSeconds + 0.35);
    const endBoundary = Math.max(startBoundary, totalDuration - Math.max(0.35, outroDurationSeconds + 0.35));
    const available = endBoundary - startBoundary;
    if (available < 1.8) return [];
    const gap = overlayTexts.length > 1 ? 0.45 : 0;
    const rawDuration = (available - gap * Math.max(0, overlayTexts.length - 1)) / overlayTexts.length;
    const overlayDuration = Math.min(4.2, Math.max(1.8, rawDuration));
    const totalNeeded = overlayDuration * overlayTexts.length + gap * Math.max(0, overlayTexts.length - 1);
    const offset = Math.max(0, (available - totalNeeded) / 2);
    return overlayTexts.map((text, index) => {
      const start = startBoundary + offset + index * (overlayDuration + gap);
      const end = Math.min(endBoundary, start + overlayDuration);
      return { text, start, end };
    });
  }, [introDurationSeconds, montageInfo?.durationSeconds, outroDurationSeconds, overlayTexts]);

  useEffect(() => {
    if (!videoBlob || fallbackState?.source === videoUrl) return;
    const timeout = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setReadySource(effectiveVideoUrl);
        return;
      }
      const replacementUrl = URL.createObjectURL(videoBlob);
      setFallbackState({ source: videoUrl, url: replacementUrl });
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [videoBlob, fallbackState, videoUrl, effectiveVideoUrl]);

  useEffect(() => {
    return () => {
      if (fallbackState?.url) URL.revokeObjectURL(fallbackState.url);
    };
  }, [fallbackState]);

  const markReady = () => {
    setErrorSource((current) => (current === effectiveVideoUrl ? null : current));
    setReadySource(effectiveVideoUrl);
  };
  const markError = () => setErrorSource(effectiveVideoUrl);
  const syncOverlayToVideo = () => {
    if (!videoRef.current || overlayWindows.length === 0) {
      setCurrentTimeSeconds(videoRef.current?.currentTime ?? 0);
      setActiveOverlayIndex(null);
      return;
    }
    const currentTime = videoRef.current.currentTime;
    setCurrentTimeSeconds(currentTime);
    const index = overlayWindows.findIndex((window) => currentTime >= window.start && currentTime < window.end);
    const nextIndex = index >= 0 ? index : null;
    setActiveOverlayIndex((current) => (current === nextIndex ? current : nextIndex));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-2xl shadow-black/50">
        <video
          key={effectiveVideoUrl}
          ref={videoRef}
          src={effectiveVideoUrl}
          className="h-full w-full object-cover"
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          onLoadedMetadata={markReady}
          onLoadedData={markReady}
          onCanPlay={markReady}
          onPlaying={markReady}
          onError={markError}
          onTimeUpdate={syncOverlayToVideo}
          onSeeked={syncOverlayToVideo}
        />
        {loadState === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-[11px] font-medium text-white/45">
            Loading reel preview…
          </div>
        )}
        {loadState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 px-5 text-center text-[11px] font-medium text-white/55">
            Preview failed to load on this pass. Download the MP4 or regenerate the Reel.
          </div>
        )}

        {/* Subtle style color-grade on top of the real ffmpeg.wasm cut (which already applies the style's cuts/zoom/transitions) */}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${styleDef.gradient} mix-blend-overlay opacity-15`} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/20" />

        {/* Hook text overlay */}
        {showPreviewChrome && overlayWindows.length > 0 && activeOverlayIndex !== null && (
          <div className="absolute inset-x-5 bottom-28 flex justify-center">
            <motion.div
              key={`${activeOverlayIndex}-${overlayWindows[activeOverlayIndex].text}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-[88%] rounded-full bg-black/52 px-4 py-2 text-center text-[11px] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur"
            >
              {overlayWindows[activeOverlayIndex].text}
            </motion.div>
          </div>
        )}
        {showPreviewChrome && (
          <div className="absolute inset-x-3 bottom-16">
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold leading-snug text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
            >
              {hookText}
            </motion.p>
          </div>
        )}

        {/* Simulated timeline of detected best moments */}
        {showPreviewChrome && (
          <div className="absolute inset-x-3 bottom-6 flex gap-1">
            {bestMoments.map((m) => (
              <div key={m.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full brand-gradient" style={{ width: `${m.confidence}%` }} />
              </div>
            ))}
          </div>
        )}

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

    </div>
  );
}
