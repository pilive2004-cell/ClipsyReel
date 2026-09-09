"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Film } from "lucide-react";
import { BestMoment, ReelStyle, ReelTitleColor, ReelTitleFont, ReelTitleSize } from "@/types";
import { STYLES } from "@/data/mock";
import { isCoherentDisplayText } from "@/lib/display-text";
import { useLocale } from "@/lib/i18n";

interface ReelPreviewProps {
  videoUrl: string;
  videoBlob?: Blob;
  style: ReelStyle;
  hookText: string;
  bestMoments: BestMoment[];
  watermark: boolean;
  reelTitle?: string;
  reelTitleFont?: ReelTitleFont;
  reelTitleSize?: ReelTitleSize;
  reelTitleColor?: ReelTitleColor;
  overlayTexts?: string[];
  overlayFonts?: [ReelTitleFont, ReelTitleFont, ReelTitleFont];
  overlaySizes?: [ReelTitleSize, ReelTitleSize, ReelTitleSize];
  overlayColors?: [ReelTitleColor, ReelTitleColor, ReelTitleColor];
  introDurationSeconds?: number;
  outroDurationSeconds?: number;
  /** Real montage stats from ffmpeg.wasm rendering (clip count / final duration). */
  montageInfo?: { clipCount: number; durationSeconds: number };
  /** Creative Style Engine effects actually burned into this render — shown as a "what changed" summary. */
  appliedEffects?: string[];
  /** Effects the style wanted but were stripped on Free — a concrete, specific upsell. */
  proLockedEffects?: string[];
  /** The Editing Pattern (structural template) chosen for this render — see `src/data/editingPatterns.ts`. */
  editingPattern?: { name: string; description: string };
  onUpgradeClick?: () => void;
  routeLabel?: string | null;
  sportTelemetry?: SportTelemetry | null;
}

interface SportTelemetry {
  distanceKm: number;
  durationLabel: string;
  elevationGainM: number;
  highestPointM: number | null;
  maxSpeedKmh: number | null;
}

function buildSportHookLayout(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { kicker: "", main: words.join(" "), accent: "" };
  }
  if (words.length === 2) {
    return { kicker: words[0], main: words[1], accent: "" };
  }
  if (words.length === 3) {
    return { kicker: words[0], main: words[1], accent: words[2] };
  }
  if (words.length === 4) {
    return { kicker: words[0], main: `${words[1]} ${words[2]}`, accent: words[3] };
  }

  const pivot = Math.max(2, Math.min(words.length - 2, Math.ceil(words.length / 2)));
  return {
    kicker: words[0],
    main: words.slice(1, pivot).join(" "),
    accent: words.slice(pivot).join(" "),
  };
}

function sportHookTypographyClass(length: number) {
  if (length <= 16) return "font-sans font-black italic tracking-[-0.09em]";
  if (length <= 28) return "font-serif font-black italic tracking-[-0.06em]";
  if (length <= 42) return "font-sans font-extrabold tracking-[-0.05em]";
  return "font-mono font-bold tracking-[0.03em]";
}

export default function ReelPreview({
  videoUrl,
  videoBlob,
  style,
  hookText,
  bestMoments,
  watermark,
  reelTitle = "",
  reelTitleFont = "cinematic",
  reelTitleSize = "md",
  reelTitleColor = "white",
  overlayTexts = [],
  overlayFonts = ["cinematic", "cinematic", "cinematic"],
  overlaySizes = ["md", "md", "md"],
  overlayColors = ["white", "white", "white"],
  introDurationSeconds = 0,
  outroDurationSeconds = 0,
  montageInfo,
  routeLabel,
  sportTelemetry,
}: ReelPreviewProps) {
  const { copy } = useLocale();
  const HOOK_FADE_IN_SECONDS = 0.72;
  const HOOK_HOLD_SECONDS = 2.35;
  const HOOK_FADE_OUT_SECONDS = 0.72;
  const HOOK_CYCLE_SECONDS = HOOK_FADE_IN_SECONDS + HOOK_HOLD_SECONDS + HOOK_FADE_OUT_SECONDS;
  const styleDef = STYLES.find((s) => s.id === style)!;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousTypedLengthRef = useRef(0);
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
  const sportPlaybackProgress = showPreviewChrome && Number.isFinite(montageWindow.end)
    ? Math.max(0, Math.min(1, (currentTimeSeconds - montageWindow.start) / Math.max(0.01, montageWindow.end - montageWindow.start)))
    : 0;
  const sportMetricValues = useMemo(() => {
    if (style !== "sport") return null;
    const eased = 1 - Math.pow(1 - sportPlaybackProgress, 1.65);
    return {
      distanceKm: sportTelemetry ? sportTelemetry.distanceKm * eased : null,
      elevationGainM: sportTelemetry ? Math.round(sportTelemetry.elevationGainM * Math.pow(eased, 1.12)) : null,
      highestPointM: sportTelemetry?.highestPointM ? Math.round(sportTelemetry.highestPointM * (0.55 + eased * 0.45)) : null,
      maxSpeedKmh: sportTelemetry?.maxSpeedKmh ? Math.round(sportTelemetry.maxSpeedKmh * (0.38 + eased * 0.62)) : null,
    };
  }, [sportPlaybackProgress, sportTelemetry, style]);
  const coherentRouteLabel = useMemo(
    () => (isCoherentDisplayText(routeLabel) ? routeLabel?.trim() ?? null : null),
    [routeLabel]
  );
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
  const titleWindow = useMemo(() => {
    const totalDuration = Math.max(montageInfo?.durationSeconds ?? 0, 1);
    const start = Math.max(0.35, introDurationSeconds + 0.35);
    const endBoundary = Math.max(start, totalDuration - Math.max(0.35, outroDurationSeconds + 0.35));
    const available = endBoundary - start;
    if (available < 1.1) return null;
    const duration = Math.min(2.2, Math.max(1.2, available * 0.2));
    return { start, end: Math.min(endBoundary, start + duration) };
  }, [introDurationSeconds, montageInfo?.durationSeconds, outroDurationSeconds]);
  const titleFontClass = reelTitleFont === "classic"
    ? "font-serif"
    : reelTitleFont === "modern"
      ? "font-sans tracking-wide"
      : reelTitleFont === "bold"
        ? "font-sans font-black tracking-tight"
        : reelTitleFont === "minimal"
          ? "font-sans font-light tracking-[0.12em]"
          : reelTitleFont === "handwritten"
            ? "font-serif italic tracking-[0.02em]"
              : reelTitleFont === "elegant"
                ? "font-serif font-medium tracking-[0.06em]"
                : reelTitleFont === "impact"
                  ? "font-sans font-extrabold uppercase tracking-tight"
                  : reelTitleFont === "mono"
                    ? "font-mono tracking-[0.08em]"
                    : reelTitleFont === "rounded"
                      ? "font-sans font-semibold tracking-[0.04em]"
              : "font-serif italic tracking-[0.08em]";
  const titleSizeClass = reelTitleSize === "sm"
    ? "text-base"
    : reelTitleSize === "lg"
      ? "text-2xl"
      : "text-xl";
  const titleColorClass = reelTitleColor === "gold"
    ? "text-amber-300"
    : reelTitleColor === "coral"
      ? "text-orange-300"
      : reelTitleColor === "cyan"
        ? "text-cyan-300"
        : reelTitleColor === "lime"
          ? "text-lime-300"
          : reelTitleColor === "violet"
            ? "text-violet-300"
            : reelTitleColor === "pink"
              ? "text-pink-300"
              : reelTitleColor === "red"
                ? "text-red-400"
                : reelTitleColor === "blue"
                  ? "text-blue-400"
                  : reelTitleColor === "emerald"
                    ? "text-emerald-300"
                    : reelTitleColor === "peach"
                      ? "text-orange-200"
                      : reelTitleColor === "silver"
                        ? "text-slate-300"
            : "text-white";
  const titleFrameColor = reelTitleColor === "gold"
    ? "#fbbf24"
    : reelTitleColor === "coral"
      ? "#fdba74"
      : reelTitleColor === "cyan"
        ? "#67e8f9"
        : reelTitleColor === "lime"
          ? "#bef264"
          : reelTitleColor === "violet"
            ? "#c4b5fd"
            : reelTitleColor === "pink"
              ? "#f9a8d4"
              : reelTitleColor === "red"
                ? "#f87171"
                : reelTitleColor === "blue"
                  ? "#60a5fa"
                  : reelTitleColor === "emerald"
                    ? "#6ee7b7"
                    : reelTitleColor === "peach"
                      ? "#fed7aa"
                      : reelTitleColor === "silver"
                        ? "#cbd5e1"
                        : "#ffffff";
  const trimmedHookText = hookText.trim();
  const coherentHookText = isCoherentDisplayText(trimmedHookText) ? trimmedHookText : "";
  const hookTextLength = coherentHookText.length;
  const hookTextSizeClass = hookTextLength <= 20
    ? "text-[26px] leading-[1.08]"
    : hookTextLength <= 36
      ? "text-[22px] leading-[1.14]"
      : hookTextLength <= 52
        ? "text-[18px] leading-[1.18]"
        : "text-[16px] leading-[1.2]";
  const easeInOut = (value: number) => value * value * (3 - 2 * value);
  const hookTimeline = useMemo(() => {
    if (!showPreviewChrome || hookTextLength === 0) {
      return { opacity: 0, typedLength: 0 };
    }
    const elapsedSinceMontageStart = Math.max(0, currentTimeSeconds - montageWindow.start);
    const cyclePosition = elapsedSinceMontageStart % HOOK_CYCLE_SECONDS;
    const fadeOutStart = HOOK_FADE_IN_SECONDS + HOOK_HOLD_SECONDS;
    let opacity = 0;
    if (cyclePosition < HOOK_FADE_IN_SECONDS) {
      opacity = easeInOut(cyclePosition / HOOK_FADE_IN_SECONDS);
    } else if (cyclePosition < fadeOutStart) {
      opacity = 1;
    } else {
      opacity = 1 - easeInOut((cyclePosition - fadeOutStart) / HOOK_FADE_OUT_SECONDS);
    }

    const typingDuration = Math.min(1.45, Math.max(0.8, hookTextLength * 0.03));
    const typingProgress = Math.min(1, easeInOut(Math.min(1, cyclePosition / typingDuration)));
    const typedLength = Math.max(0, Math.min(hookTextLength, Math.floor(hookTextLength * typingProgress)));
    return { opacity, typedLength };
  }, [HOOK_CYCLE_SECONDS, HOOK_FADE_IN_SECONDS, HOOK_FADE_OUT_SECONDS, HOOK_HOLD_SECONDS, currentTimeSeconds, hookTextLength, montageWindow.start, showPreviewChrome]);
  const typedHookText = coherentHookText.slice(0, hookTimeline.typedLength);
  const sportHookLayout = useMemo(() => buildSportHookLayout(coherentHookText), [coherentHookText]);

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

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (style === "sport" || !showPreviewChrome || hookTextLength === 0 || document.hidden) {
      previousTypedLengthRef.current = hookTimeline.typedLength;
      return;
    }
    if (hookTimeline.typedLength <= previousTypedLengthRef.current) {
      previousTypedLengthRef.current = hookTimeline.typedLength;
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      console.warn("[ReelPreview] AudioContext API unavailable for typewriter sound effect.");
      previousTypedLengthRef.current = hookTimeline.typedLength;
      return;
    }
    const nextAudioContext = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = nextAudioContext;
    if (nextAudioContext.state === "suspended") {
      void nextAudioContext.resume().catch((error: unknown) => {
        console.warn("[ReelPreview] Unable to resume typewriter audio context:", error);
      });
    }

    const addedCharacters = hookTimeline.typedLength - previousTypedLengthRef.current;
    previousTypedLengthRef.current = hookTimeline.typedLength;
    for (let i = 0; i < addedCharacters; i++) {
      const oscillator = nextAudioContext.createOscillator();
      const gain = nextAudioContext.createGain();
      const startTime = nextAudioContext.currentTime + i * 0.026;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(1750, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.015, startTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);
      oscillator.connect(gain);
      gain.connect(nextAudioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.043);
    }
  }, [hookTextLength, hookTimeline.typedLength, showPreviewChrome, style]);

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
            {copy.preview.readyAlt}
          </div>
        )}
        {loadState === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 px-5 text-center text-[11px] font-medium text-white/55">
            {copy.render.error}
          </div>
        )}

        {/* Subtle style color-grade on top of the real ffmpeg.wasm cut (which already applies the style's cuts/zoom/transitions) */}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${styleDef.gradient} mix-blend-overlay opacity-15`} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/20" />
        {showPreviewChrome && style === "sport" && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage: "linear-gradient(rgba(34,211,238,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.07) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div className="absolute inset-0 opacity-[0.22] mix-blend-screen">
              {[
                { left: "14%", top: "12%", width: "34%", rotate: "-22deg", opacity: 0.22 },
                { left: "58%", top: "20%", width: "26%", rotate: "18deg", opacity: 0.16 },
                { left: "18%", top: "56%", width: "42%", rotate: "-12deg", opacity: 0.2 },
                { left: "64%", top: "66%", width: "22%", rotate: "24deg", opacity: 0.14 },
                { left: "10%", top: "78%", width: "30%", rotate: "10deg", opacity: 0.18 },
              ].map((scratch, index) => (
                <div
                  key={index}
                  className="absolute h-px rounded-full bg-white"
                  style={{
                    left: scratch.left,
                    top: scratch.top,
                    width: scratch.width,
                    opacity: scratch.opacity,
                    transform: `rotate(${scratch.rotate})`,
                    boxShadow: "0 0 10px rgba(255,255,255,0.12)",
                  }}
                />
              ))}
            </div>
            <div className="absolute left-3 top-3 rounded-[18px] border border-cyan-300/16 bg-slate-950/58 px-2.5 py-2 backdrop-blur-md">
              <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-100/58">SPORT LAB</p>
              {coherentRouteLabel && <p className="mt-1 max-w-[124px] text-[11px] font-semibold leading-tight text-white/92">{coherentRouteLabel}</p>}
            </div>
            <div className="absolute right-3 top-3 grid gap-1.5">
              <PreviewMetric label="KM" value={sportMetricValues?.distanceKm !== null && sportMetricValues?.distanceKm !== undefined ? sportMetricValues.distanceKm.toFixed(1) : "—"} accent="cyan" />
              <PreviewMetric label="D+" value={sportMetricValues?.elevationGainM !== null && sportMetricValues?.elevationGainM !== undefined ? `${sportMetricValues.elevationGainM}` : "—"} accent="violet" />
            </div>
            <div className="absolute left-3 right-3 top-[43%] rounded-[18px] border border-white/10 bg-slate-950/34 px-3 py-2 backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-white/45">
                <span>route schematic</span>
                <span>{Math.round(sportPlaybackProgress * 100)}%</span>
              </div>
              <div className="relative h-10">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/12" />
                <div className="absolute left-[10%] right-[10%] top-1/2 h-px -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.32),rgba(168,85,247,0.28))]" />
                <motion.div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/85 bg-fuchsia-400 shadow-[0_0_0_5px_rgba(236,72,153,0.14)]"
                  animate={{ left: `${Math.max(8, sportPlaybackProgress * 92)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
                <div className="absolute left-[18%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-[2px] border border-cyan-300 bg-cyan-300/20" />
                <div className="absolute left-[60%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/70 bg-white/15" />
                <div className="absolute right-[12%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-fuchsia-300 bg-fuchsia-300/20" />
              </div>
            </div>
            <div className="absolute bottom-4 left-3 right-3 flex items-end justify-between gap-3">
              <div className="rounded-[18px] border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/45">runtime</p>
                <p className="mt-1 text-[11px] font-semibold text-white/88">{sportTelemetry?.durationLabel ?? "—"}</p>
              </div>
              <div className="w-[46%] rounded-[18px] border border-cyan-300/18 bg-slate-950/55 px-3 py-2 backdrop-blur-md">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#a855f7)]"
                    style={{ width: `${Math.max(6, sportPlaybackProgress * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-white/45">
                  <span>route sync</span>
                  <span>{Math.round(sportPlaybackProgress * 100)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPreviewChrome && style === "sport" && !montageInfo && hookTextLength > 0 && (
          <div className="pointer-events-none absolute inset-x-4 top-[18%] flex justify-start">
            <motion.div
              initial={{ opacity: 0, x: -20, y: 18, rotate: -3, scale: 0.98 }}
              animate={{ opacity: hookTimeline.opacity, x: 0, y: 0, rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 110, damping: 18 }}
              className="relative max-w-[92%] text-left"
              style={{ textShadow: "0 8px 28px rgba(0,0,0,0.68)" }}
            >
              <div className="absolute -left-2 -top-2 h-12 w-12 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-xl" />
              <div className="relative space-y-0.5">
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: hookTimeline.opacity, x: 0 }}
                  transition={{ delay: 0.02, duration: 0.35 }}
                  className="text-[10px] font-semibold uppercase tracking-[0.5em] text-white/58"
                >
                  hook
                </motion.p>
                {sportHookLayout.kicker && (
                  <motion.p
                    initial={{ opacity: 0, x: -14, y: 10, rotate: -1 }}
                    animate={{ opacity: hookTimeline.opacity, x: 0, y: 0, rotate: -0.5 }}
                    transition={{ delay: 0.05, type: "spring", stiffness: 150, damping: 18 }}
                    className="text-[clamp(12px,3vw,18px)] font-semibold uppercase tracking-[0.42em] text-white/75"
                  >
                    {sportHookLayout.kicker}
                  </motion.p>
                )}
                <motion.p
                  initial={{ opacity: 0, x: -18, y: 12, rotate: -2, scale: 0.96 }}
                  animate={{ opacity: hookTimeline.opacity, x: 0, y: 0, rotate: 0, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 135, damping: 18 }}
                  className={`max-w-[100%] break-words uppercase leading-[0.86] ${sportHookTypographyClass(hookTextLength)} text-[clamp(40px,11vw,112px)] text-white`}
                >
                  {sportHookLayout.main}
                </motion.p>
                {sportHookLayout.accent && (
                  <motion.p
                    initial={{ opacity: 0, x: 12, y: 8, rotate: 1.5 }}
                    animate={{ opacity: hookTimeline.opacity, x: 0, y: 0, rotate: 0 }}
                    transition={{ delay: 0.18, type: "spring", stiffness: 120, damping: 20 }}
                    className="max-w-[100%] break-words text-[clamp(20px,4.8vw,48px)] font-semibold uppercase tracking-[0.22em] text-yellow-300"
                  >
                    {sportHookLayout.accent}
                  </motion.p>
                )}
              </div>
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: hookTimeline.opacity > 0 ? 1 : 0, opacity: hookTimeline.opacity }}
                transition={{ delay: 0.18, duration: 0.38, ease: "easeOut" }}
                className="mt-3 h-1 origin-left w-28 bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(255,230,0,0.95),rgba(168,85,247,0.0))]"
              />
            </motion.div>
          </div>
        )}

        {/* Overlay texts with cinematic animations and styling */}
        {showPreviewChrome && !montageInfo && overlayWindows.length > 0 && activeOverlayIndex !== null && (
          <div className={style === "sport" ? "pointer-events-none absolute left-3 right-[34%] top-[36%] flex justify-start" : "pointer-events-none absolute inset-x-4 bottom-[18%] flex justify-start"}>
            {(() => {
              const overlay = overlayWindows[activeOverlayIndex];
              const overlayFont = overlayFonts[activeOverlayIndex];
              const overlaySize = overlaySizes[activeOverlayIndex];
              const overlayColor = overlayColors[activeOverlayIndex];

              const fontClass = overlayFont === "classic"
                ? "font-serif"
                : overlayFont === "modern"
                  ? "font-sans tracking-wide"
                  : overlayFont === "bold"
                    ? "font-sans font-black tracking-tight"
                    : overlayFont === "minimal"
                      ? "font-sans font-light tracking-[0.12em]"
                      : overlayFont === "handwritten"
                        ? "font-handwriting"
                        : overlayFont === "elegant"
                          ? "font-serif italic"
                          : overlayFont === "impact"
                            ? "font-sans font-black"
                            : overlayFont === "mono"
                              ? "font-mono"
                              : overlayFont === "rounded"
                                ? "font-rounded"
                                : "font-sans";

              const sizeClass = overlaySize === "sm"
                ? "text-xl leading-tight"
                : overlaySize === "lg"
                  ? "text-3xl leading-tight"
                  : "text-2xl leading-tight";

              const colorClass = overlayColor === "white"
                ? "text-white"
                : overlayColor === "gold"
                  ? "text-amber-300"
                  : overlayColor === "coral"
                    ? "text-orange-400"
                    : overlayColor === "cyan"
                      ? "text-cyan-400"
                      : overlayColor === "lime"
                        ? "text-lime-300"
                        : overlayColor === "violet"
                          ? "text-violet-300"
                          : overlayColor === "pink"
                            ? "text-pink-300"
                            : overlayColor === "red"
                              ? "text-red-400"
                              : overlayColor === "blue"
                                ? "text-blue-400"
                                : overlayColor === "emerald"
                                  ? "text-emerald-300"
                                  : overlayColor === "peach"
                                    ? "text-orange-200"
                                    : "text-slate-300";

              const fadeDuration = 0.5;
              const elapsedInWindow = Math.max(0, currentTimeSeconds - overlay.start);
              const windowDuration = overlay.end - overlay.start;
              const progress = Math.min(1, elapsedInWindow / windowDuration);

              let opacity = 1;
              if (progress < fadeDuration / windowDuration) {
                opacity = (progress * windowDuration) / fadeDuration;
              } else if (progress > 1 - fadeDuration / windowDuration) {
                opacity = ((1 - progress) * windowDuration) / fadeDuration;
              }

              return (
                <motion.div
                  key={`${activeOverlayIndex}-${overlay.text}`}
                  initial={{ opacity: 0, scale: 0.95, x: -10 }}
                  animate={{ opacity, scale: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className={style === "sport"
                    ? `max-w-[84%] rounded-2xl border border-cyan-300/20 bg-slate-950/55 px-3 py-2 text-left ${fontClass} ${sizeClass} ${colorClass} font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)] backdrop-blur-sm`
                    : `max-w-[82%] text-left ${fontClass} ${sizeClass} ${colorClass} font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]`}
                >
                  {overlay.text}
                </motion.div>
              );
            })()}
          </div>
        )}
        {showPreviewChrome &&
          reelTitle.trim().length > 0 &&
          !montageInfo &&
          titleWindow &&
          currentTimeSeconds >= titleWindow.start &&
          currentTimeSeconds < titleWindow.end && (
          <div className="absolute inset-x-3 top-20 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center justify-center rounded-xl border border-[1.5px] bg-transparent px-3 py-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
              style={{ borderColor: titleFrameColor }}
            >
              <p className={`text-center leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${titleColorClass} ${titleFontClass} ${titleSizeClass}`}>
                {reelTitle}
              </p>
            </motion.div>
          </div>
        )}
        {showPreviewChrome && style !== "sport" && !montageInfo && hookTextLength > 0 && overlayWindows.length === 0 && (
          <div className="pointer-events-none absolute inset-x-4 top-[30%] flex justify-center" style={{ opacity: hookTimeline.opacity, transition: "opacity 120ms linear" }}>
            <p className={`relative max-w-[82%] text-center font-extrabold tracking-[0.01em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] ${hookTextSizeClass}`}>
              <span className="invisible">{trimmedHookText}</span>
              <span className="absolute inset-0">{typedHookText}</span>
            </p>
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
          <div className="absolute left-3 top-4 flex items-center gap-2 rounded-full bg-black/42 px-2.5 py-1.5 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg brand-gradient shadow-lg shadow-fuchsia-500/20">
              <Clapperboard className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-semibold tracking-tight text-white/92">
              Clipsy<span className="brand-gradient-text">Reel</span>
            </span>
          </div>
        )}
      </div>

      {montageInfo && (
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Film className="h-3 w-3" />
        {copy.preview.ready} · {montageInfo.clipCount} clips cross-faded · {montageInfo.durationSeconds.toFixed(1)}s
        </div>
      )}

    </div>
  );
}

function PreviewMetric({ label, value, accent = "cyan" }: { label: string; value: string; accent?: "cyan" | "violet" }) {
  const accentClass = accent === "violet" ? "text-violet-200/60" : "text-cyan-100/55";
  return (
    <div className="rounded-[16px] border border-white/10 bg-slate-950/60 px-2 py-1.5 text-right backdrop-blur-md shadow-[0_10px_24px_rgba(2,6,23,0.18)]">
      <p className={`text-[8px] uppercase tracking-[0.18em] ${accentClass}`}>{label}</p>
      <motion.p
        className="mt-0.5 text-[10px] font-semibold text-white/92"
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        {value}
      </motion.p>
    </div>
  );
}
