"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Film } from "lucide-react";
import HookTitle from "@/components/HookTitle";
import ScratchTransition from "@/components/ScratchTransition";
import { STYLES } from "@/data/mock";
import { filterCoherentDisplayTexts, isCoherentDisplayText } from "@/lib/display-text";
import { useLocale } from "@/lib/i18n";
import { buildSportHookSequence, planSportHookWindows } from "@/lib/sport-style";
import { BestMoment, ReelStyle, ReelTitleColor, ReelTitleFont, ReelTitleSize, SportTelemetry } from "@/types";

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

export default function ReelPreview({
  videoUrl,
  videoBlob,
  style,
  hookText,
  bestMoments,
  watermark,
  reelTitle = "",
  reelTitleFont = "bold",
  reelTitleSize = "md",
  reelTitleColor = "white",
  overlayTexts = [],
  overlayFonts = ["bold", "bold", "bold"],
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
  const coherentRouteLabel = useMemo(
    () => (isCoherentDisplayText(routeLabel) ? routeLabel?.trim() ?? null : null),
    [routeLabel]
  );
  const coherentOverlayTexts = useMemo(() => filterCoherentDisplayTexts(overlayTexts ?? []), [overlayTexts]);
  const titleWindow = useMemo(() => {
    const totalDuration = Math.max(montageInfo?.durationSeconds ?? 0, 1);
    const start = style === "sport"
      ? Math.max(0.3, introDurationSeconds + 0.28)
      : Math.max(0.35, introDurationSeconds + 0.35);
    const endBoundary = Math.max(start, totalDuration - Math.max(0.35, outroDurationSeconds + 0.35));
    const available = endBoundary - start;
    if (available < 1.1 || reelTitle.trim().length === 0) return null;
    if (style === "sport") {
      const duration = Math.min(3.3, Math.max(1.9, available * 0.18));
      return { start, end: Math.min(endBoundary, start + duration) };
    }
    const duration = Math.min(2.2, Math.max(1.2, available * 0.2));
    return { start, end: Math.min(endBoundary, start + duration) };
  }, [introDurationSeconds, montageInfo?.durationSeconds, outroDurationSeconds, reelTitle, style]);
  const sportHookBeats = useMemo(
    () => buildSportHookSequence({
      routeLabel: coherentRouteLabel,
      sportTelemetry,
      fallbackText: hookText,
      customTexts: coherentOverlayTexts,
      overlayFonts,
      overlaySizes,
      overlayColors,
    }),
    [coherentOverlayTexts, coherentRouteLabel, hookText, overlayColors, overlayFonts, overlaySizes, sportTelemetry]
  );
  const sportHookWindows = useMemo(
    () => planSportHookWindows(
      sportHookBeats,
      Math.max(montageInfo?.durationSeconds ?? 0, 1),
      introDurationSeconds,
      outroDurationSeconds,
      titleWindow ? titleWindow.end + 0.45 : 0
    ),
    [introDurationSeconds, montageInfo?.durationSeconds, outroDurationSeconds, sportHookBeats, titleWindow]
  );
  const overlayWindows = useMemo(() => {
    if (overlayTexts.length === 0) return [];
    if (style === "sport") {
      return sportHookWindows;
    }
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
  }, [introDurationSeconds, montageInfo?.durationSeconds, outroDurationSeconds, overlayTexts, sportHookWindows, style]);
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
    ? "text-slate-900"
    : reelTitleColor === "coral"
      ? "text-slate-800"
      : reelTitleColor === "cyan"
        ? "text-slate-900"
        : reelTitleColor === "lime"
          ? "text-slate-900"
          : reelTitleColor === "violet"
            ? "text-violet-50"
            : reelTitleColor === "pink"
              ? "text-rose-950"
              : reelTitleColor === "red"
                ? "text-red-50"
                : reelTitleColor === "blue"
                  ? "text-blue-50"
                  : reelTitleColor === "emerald"
                    ? "text-emerald-950"
                    : reelTitleColor === "peach"
                      ? "text-slate-800"
                      : reelTitleColor === "silver"
                        ? "text-slate-900"
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
  const activeSportHookIndex =
    style === "sport"
      ? overlayWindows.findIndex((window) => currentTimeSeconds >= window.start && currentTimeSeconds < window.end)
      : -1;
  const activeSportHookBeat = activeSportHookIndex >= 0 ? sportHookWindows[activeSportHookIndex] : null;

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
          <>
            <div
              className="pointer-events-none absolute inset-0 opacity-45"
              style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <ScratchTransition
              activeKey={`sport-${activeSportHookIndex >= 0 ? activeSportHookIndex : "idle"}`}
              effect={activeSportHookBeat?.effect ?? "scratch"}
              theme={activeSportHookBeat?.theme ?? "sport"}
            />
            <HookTitle beats={sportHookBeats} activeIndex={activeSportHookIndex >= 0 ? activeSportHookIndex : null} />
          </>
        )}

        {/* Overlay texts with cinematic animations and styling */}
        {showPreviewChrome && style !== "sport" && !montageInfo && overlayWindows.length > 0 && activeOverlayIndex !== null && (
          <div className="pointer-events-none absolute inset-x-4 bottom-[18%] flex justify-start">
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
                  className={`max-w-[82%] text-left ${fontClass} ${sizeClass} ${colorClass} font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]`}
                >
                  {overlay.text}
                </motion.div>
              );
            })()}
          </div>
        )}
        {showPreviewChrome &&
          reelTitle.trim().length > 0 &&
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
