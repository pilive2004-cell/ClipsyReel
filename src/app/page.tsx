"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Lock, RotateCcw, Type } from "lucide-react";

import AppShell from "@/components/AppShell";
import HeroSection from "@/components/HeroSection";
import VideoUploader from "@/components/VideoUploader";
import StyleSelector from "@/components/StyleSelector";
import AIAnalysisPanel from "@/components/AIAnalysisPanel";
import RenderPanel from "@/components/RenderPanel";
import ReelPreview from "@/components/ReelPreview";
import HookCaptionPanel from "@/components/HookCaptionPanel";
import ReelNamePanel from "@/components/ReelNamePanel";
import RouteSourceSelector from "@/components/RouteSourceSelector";
import PricingModal from "@/components/PricingModal";
import UpgradePrompt from "@/components/UpgradePrompt";
import ExportPanel from "@/components/ExportPanel";
import CreationExtrasPanel from "@/components/CreationExtrasPanel";
import RouteMapIntro, { RouteIntroClip, type RouteCinematicProfile } from "@/components/gpx/RouteMapIntro";

import { usePlan } from "@/lib/plan-context";
import { useLocale } from "@/lib/i18n";
import { buildAdventureReelOverlay, buildAdventureSetupSessionKey, createEmptyAdventureSetup } from "@/lib/adventure-setup";
import { loadAdventureSetupDraft, saveAdventureSetupDraft } from "@/lib/adventure-setup-storage";
import { computeRouteMetrics } from "@/modules/route3d/routeMetrics";
import RouteStoryPlayer from "@/modules/route3d/RouteStoryPlayer";
import { generateGearSummaryClip, GearSummaryClip } from "@/lib/gear-summary-clip";
import { filterCoherentDisplayTexts, isCoherentDisplayText } from "@/lib/display-text";
import { buildSportHookSequence } from "@/lib/sport-style";
import { buildAnalysisResult, generateMockAnalysisMulti } from "@/data/mock";
import { buildMontage, preloadRenderPipeline, qualityForPlan } from "@/lib/video-engine";
import { buildGearSummaryEntries, DEFAULT_GEAR_SELECTIONS } from "@/data/gearCatalog";
import { AdventureSetup, AppStep, BestMoment, GpxRouteStats, GpxTrackPoint, MontageResult, ReelAnalysisResult, ReelStyle, ReelTitleColor, ReelTitleFont, ReelTitleSize, RouteLabel, UploadedVideo } from "@/types";

const STEP_ORDER: AppStep[] = ["upload", "style", "analyze", "render", "preview"];
const NO_HOOK_ID = "__no_hook__";
const CUSTOM_HOOK_ID = "__custom_hook__";
const CUSTOM_CAPTION_ID = "__custom_caption__";
let activeRenderSignature: string | null = null;

function cinematicProfileForStyle(style: ReelStyle | null): RouteCinematicProfile {
  if (style === "luxury" || style === "cinematic") return "earth-studio";
  if (style === "sport" || style === "viral") return "dji-fly";
  return "relive";
}

function safeMaxSpeedKmh(points: GpxTrackPoint[] | null | undefined): number | null {
  if (!points || points.length < 2) return null;
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev.time || !curr.time) continue;
    const deltaSeconds = (curr.time.getTime() - prev.time.getTime()) / 1000;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 3) continue;
    const distKm = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
    const speedKmh = (distKm / deltaSeconds) * 3600;
    if (!Number.isFinite(speedKmh) || speedKmh <= 0 || speedKmh > 180) continue;
    max = Math.max(max, speedKmh);
  }
  return max > 0 ? Math.round(max) : null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Home() {
  const { isFree, reelsUsedThisWeek, weeklyFreeLimit, consumeReelCredit } = usePlan();
  const { copy, locale } = useLocale();

  const [step, setStep] = useState<AppStep>("upload");
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [style, setStyle] = useState<ReelStyle | null>(null);
  const [analysis, setAnalysis] = useState<ReelAnalysisResult | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string>(NO_HOOK_ID);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string>("");
  const [customHookText, setCustomHookText] = useState("");
  const [customCaptionText, setCustomCaptionText] = useState("");
  const [storyTexts, setStoryTexts] = useState<string[]>(["", "", ""]);
  const [gpxStats, setGpxStats] = useState<GpxRouteStats | null>(null);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);
  const [gpxPoints, setGpxPoints] = useState<{ lat: number; lng: number }[] | null>(null);
  const [routeFocusPoints, setRouteFocusPoints] = useState<{ lat: number; lng: number }[] | null>(null);
  const [gpxFullPoints, setGpxFullPoints] = useState<GpxTrackPoint[] | null>(null);
  const [show3DStory, setShow3DStory] = useState(false);
  const [metadataCardLines, setMetadataCardLines] = useState<string[] | null>(null);
  const [adventureSetup, setAdventureSetup] = useState<AdventureSetup>(() => createEmptyAdventureSetup());
  const [adventureSetupStatus, setAdventureSetupStatus] = useState("Not saved yet");
  const [adventureSetupReady, setAdventureSetupReady] = useState(false);
  const [gearSelections, setGearSelections] = useState(DEFAULT_GEAR_SELECTIONS);
  const [gearPortraitFile, setGearPortraitFile] = useState<File | null>(null);
  const [reelTitle, setReelTitle] = useState("");
  const [reelTitleFont, setReelTitleFont] = useState<ReelTitleFont>("bold");
  const [reelTitleSize, setReelTitleSize] = useState<ReelTitleSize>("md");
  const [reelTitleColor, setReelTitleColor] = useState<ReelTitleColor>("white");
  const [overlayTexts, setOverlayTexts] = useState<[string, string, string]>(["", "", ""]);
  const [overlayFonts, setOverlayFonts] = useState<[ReelTitleFont, ReelTitleFont, ReelTitleFont]>(["bold", "bold", "bold"]);
  const [overlaySizes, setOverlaySizes] = useState<[ReelTitleSize, ReelTitleSize, ReelTitleSize]>(["md", "md", "md"]);
  const [overlayColors, setOverlayColors] = useState<[ReelTitleColor, ReelTitleColor, ReelTitleColor]>(["white", "white", "white"]);
  const [routeIntroClip, setRouteIntroClip] = useState<RouteIntroClip | null>(null);
  const [hasRouteIntro, setHasRouteIntro] = useState(false);
  const [routeIntroStatus, setRouteIntroStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [routeIntroGeneration, setRouteIntroGeneration] = useState(0);
  const [routeIntroPoints, setRouteIntroPoints] = useState<GpxTrackPoint[] | null>(null);
  const [routeIntroStats, setRouteIntroStats] = useState<GpxRouteStats | null>(null);
  const [routeIntroLabels, setRouteIntroLabels] = useState<RouteLabel[] | null>(null);
  const [gearSummaryClip, setGearSummaryClip] = useState<GearSummaryClip | null>(null);
  const [gearSummaryStatus, setGearSummaryStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [renderGateTimedOut, setRenderGateTimedOut] = useState(false);

  const [montage, setMontage] = useState<MontageResult | null>(null);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [renderPhase, setRenderPhase] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderFallbackNotice, setRenderFallbackNotice] = useState<string | null>(null);
  // The hook text that was actually baked into the last successful render —
  // compared against the live `selectedHookText` below so the Preview screen
  // can prompt the user to regenerate whenever they pick/type a different
  // hook *after* the video already rendered (picking a hook only in the
  // Preview's Hook & Caption panel would otherwise silently never make it
  // into the exported MP4).
  const [renderedHookText, setRenderedHookText] = useState("");
  // The story-caption texts actually baked into the last successful render — same regenerate-prompt pattern as `renderedHookText`.
  const [renderedStoryTexts, setRenderedStoryTexts] = useState<string[]>(["", "", ""]);
  const [renderedAdventureOverlaySignature, setRenderedAdventureOverlaySignature] = useState("");
  // Only the very first successful render of a given analysis should spend a
  // weekly/monthly Reel credit — regenerating just to bake in a new hook
  // choice must not cost the user a second credit.
  const [creditConsumed, setCreditConsumed] = useState(false);
  const renderInProgressRef = useRef(false);

  const [pricingOpen, setPricingOpen] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<{ title: string; message: string } | null>(null);
  const [isCompactMobile, setIsCompactMobile] = useState(false);
  const [mobileSectionOpen, setMobileSectionOpen] = useState<Record<string, boolean>>({
    reelName: true,
    route: false,
    hook: false,
    gear: false,
  });
  const renderPipelineWarmedRef = useRef(false);
  const routeIntroCinematicProfile = cinematicProfileForStyle(style);
  const sportTelemetry = useMemo(() => {
    if (!routeIntroPoints || routeIntroPoints.length < 2) return null;
    const metrics = computeRouteMetrics(routeIntroPoints, Math.min(routeIntroPoints.length, 240));
    return {
      distanceKm: Math.round((metrics.totalDistanceMeters / 1000) * 10) / 10,
      durationLabel: routeIntroStats?.durationLabel ?? gpxStats?.durationLabel ?? "—",
      elevationGainM: Math.round(metrics.elevationGainM),
      highestPointM:
        metrics.highestAltitudeM !== null
          ? Math.round(metrics.highestAltitudeM)
          : routeIntroStats?.highestPointM ?? gpxStats?.highestPointM ?? null,
      maxSpeedKmh: safeMaxSpeedKmh(routeIntroPoints),
    };
  }, [routeIntroPoints, routeIntroStats, gpxStats]);

  const showUpgrade = (title: string, message: string) => setUpgradePrompt({ title, message });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setIsCompactMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      if (!/ErrnoError:\s*FS error/i.test(message)) return;
      // ffmpeg.wasm can emit late FS rejections during internal cleanup while
      // a recovery pass is already running; treat these as non-fatal so the
      // runtime overlay does not interrupt a successful retry.
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  useEffect(() => {
    if (videos.length === 0 || renderPipelineWarmedRef.current) return;
    renderPipelineWarmedRef.current = true;

    let cancelled = false;
    const warmUp = () => {
      void preloadRenderPipeline().catch((error) => {
        if (!cancelled) {
          console.warn("[ClipsyReel] Render pipeline warm-up failed:", error);
        }
      });
    };

    if (typeof window === "undefined") return undefined;

    const idleCallback = window.requestIdleCallback?.(warmUp, { timeout: 2000 });
    if (idleCallback === undefined) {
      const timeoutId = window.setTimeout(warmUp, 1200);
      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }

    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(idleCallback);
    };
  }, [videos.length]);

  const weeklyLimitReached = isFree && reelsUsedThisWeek >= weeklyFreeLimit;

  const goToStyle = () => setStep("style");

  const autoGenerateCaptionFromVideos = () => {
    if (videos.length === 0) return;
    const clipCount = videos.length;
    const totalSeconds = Math.round(videos.reduce((sum, video) => sum + video.durationSeconds, 0));
    const trimmedRouteLabel = routeLabel?.trim() ?? "";
    const routePart = isCoherentDisplayText(trimmedRouteLabel) ? ` · ${trimmedRouteLabel}` : "";
    const caption = `Adventure recap${routePart}\n${clipCount} clip${clipCount > 1 ? "s" : ""} · ${totalSeconds}s of ride moments.\nBuilt with ClipsyReel.`;
    setCustomCaptionText(caption);
    setSelectedCaptionId(CUSTOM_CAPTION_ID);
  };

  const startAnalysis = () => {
    if (weeklyLimitReached) {
      showUpgrade(
        copy.pricing.title,
        copy.pricing.subtitle
      );
      return;
    }
    setStep("analyze");
  };

  const startRender = () => {
    if (!analysis || !style) return;
    if (hasRouteIntro && routeIntroPoints && routeIntroPoints.length > 1) {
      setRouteIntroClip(null);
      setRouteIntroStatus("rendering");
      setRouteIntroGeneration((current) => current + 1);
    }
    setStep("render");
  };

  const equipmentSummary = buildGearSummaryEntries(gearSelections);
  const shouldRenderGearSummary = style === "sport" || equipmentSummary.length > 0 || !!gearPortraitFile;
  const selectedHookTextRaw = analysis?.hooks.find((h) => h.id === selectedHookId)?.text ?? "";
  const selectedOverlayTexts = filterCoherentDisplayTexts(overlayTexts);
  const customHookTextFromInputs = customHookText || selectedOverlayTexts[0] || "";
  const selectedHookText = customHookTextFromInputs || (isCoherentDisplayText(selectedHookTextRaw) ? selectedHookTextRaw : "");
  const sportHookBeats = useMemo(
    () => buildSportHookSequence({ routeLabel, gpxStats, sportTelemetry, fallbackText: selectedHookText, customTexts: selectedOverlayTexts }),
    [gpxStats, routeLabel, selectedHookText, selectedOverlayTexts, sportTelemetry]
  );
  const sportOverlayTexts = style === "sport" ? sportHookBeats.map((beat) => beat.text) : selectedOverlayTexts;
  const selectedOverlayTextKey = sportOverlayTexts.join("\n");
  const reelTitleKey = `${reelTitle.trim()}|${reelTitleFont}|${reelTitleSize}|${reelTitleColor}`;
  const adventureOverlay = buildAdventureReelOverlay(adventureSetup);
  const adventureOverlaySignature = adventureOverlay ? `${adventureOverlay.title}|${adventureOverlay.lines.join("|")}` : "";

  const clearGearSummaryClip = (nextStatus: "idle" | "rendering" | "ready" | "error" = "idle") => {
    setGearSummaryStatus(nextStatus);
    setGearSummaryClip((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => {
    let cancelled = false;

    if (!shouldRenderGearSummary) return;

    queueMicrotask(() => {
      if (cancelled) return;

      void generateGearSummaryClip({ selections: gearSelections, portrait: gearPortraitFile ?? undefined, locale })
        .then((clip) => {
          if (cancelled) {
            if (clip?.url) URL.revokeObjectURL(clip.url);
            return;
          }
          setGearSummaryClip((current) => {
            if (current?.url) URL.revokeObjectURL(current.url);
            return clip;
          });
          setGearSummaryStatus(clip ? "ready" : "idle");
        })
        .catch((error) => {
          console.error(error);
          if (cancelled) return;
          setGearSummaryStatus("error");
        });
    });

    return () => {
      cancelled = true;
    };
  }, [shouldRenderGearSummary, gearSelections, gearPortraitFile, locale]);

  useEffect(() => {
    return () => {
      if (gearSummaryClip?.url) URL.revokeObjectURL(gearSummaryClip.url);
    };
  }, [gearSummaryClip]);

  useEffect(() => {
    if (step !== "render") {
      const resetTimeout = window.setTimeout(() => setRenderGateTimedOut(false), 0);
      return () => window.clearTimeout(resetTimeout);
    }

    const introPending = hasRouteIntro && routeIntroStatus === "rendering";
    const gearPending = shouldRenderGearSummary && gearSummaryStatus === "rendering";
    if (!introPending && !gearPending) {
      const resetTimeout = window.setTimeout(() => setRenderGateTimedOut(false), 0);
      return () => window.clearTimeout(resetTimeout);
    }

    const timeout = window.setTimeout(() => {
      setRenderGateTimedOut(true);
      setRenderPhase("Optional assets are taking too long — starting export without them…");
    }, 15000);

    return () => window.clearTimeout(timeout);
  }, [step, hasRouteIntro, routeIntroStatus, gearSummaryStatus, shouldRenderGearSummary]);

  useEffect(() => {
    return () => {
      if (routeIntroClip?.url) URL.revokeObjectURL(routeIntroClip.url);
    };
  }, [routeIntroClip]);

  const handleAnalysisComplete = (realBestMoments: BestMoment[] | null) => {
    if (videos.length === 0 || !style) return;
    const totalDuration = videos.reduce((sum, v) => sum + v.durationSeconds, 0);
    const combinedName = videos.length > 1 ? `${videos.length} videos combined` : videos[0].name;
    // Prefer the real, content-aware moments detected in the browser; fall
    // back to mock (random) moments only if real analysis failed.
    const result =
      realBestMoments && realBestMoments.length > 0
        ? buildAnalysisResult(combinedName, totalDuration, style, realBestMoments, gpxStats)
        : generateMockAnalysisMulti(videos, style, gpxStats);
    setAnalysis(result);
    setSelectedHookId("");
    setStep("render");
  };

  // Runs the real ffmpeg.wasm montage (cuts + Ken Burns zoom + randomized,
  // style-matched xfade transitions) across all uploaded videos, once
  // analysis has produced best-moment timestamps to cut from.
  useEffect(() => {
    if (step !== "render" || videos.length === 0 || !analysis || !style) return;
    const introReady = !hasRouteIntro || routeIntroStatus === "ready" || routeIntroStatus === "error" || renderGateTimedOut;
    const gearReady = !shouldRenderGearSummary || gearSummaryStatus === "ready" || gearSummaryStatus === "error" || gearSummaryStatus === "idle" || renderGateTimedOut;
    const renderSignature = [
      style,
      videos.map((video) => `${video.name}:${video.durationSeconds.toFixed(2)}:${video.keepAudio ? "a" : "m"}`).join("|"),
      analysis.bestMoments.map((moment) => `${moment.sourceIndex}:${moment.startSeconds.toFixed(2)}-${moment.endSeconds.toFixed(2)}`).join("|"),
      routeIntroClip ? `${routeIntroClip.durationSeconds.toFixed(2)}:${hasRouteIntro}` : "no-intro",
      gearSummaryClip ? `${gearSummaryClip.durationSeconds.toFixed(2)}` : "no-gear",
      reelTitleKey,
      selectedOverlayTextKey,
      shouldRenderGearSummary ? "gear" : "no-gear",
    ].join("||");

    if (!introReady || !gearReady) {
      return;
    }
    if (renderInProgressRef.current || activeRenderSignature === renderSignature) {
      return;
    }

    let cancelled = false;
    activeRenderSignature = renderSignature;
    renderInProgressRef.current = true;
    const hookTextForThisRender = selectedHookText;
    const storyTextsForThisRender = storyTexts;
    const sportAudioDisabled = style === "sport";
    const renderSpeedProfile: "standard" | "fast" = style === "sport" ? "standard" : "fast";
    const videoAudioEnabled = sportAudioDisabled ? videos.map(() => false) : videos.map((v) => v.keepAudio);
    const baseParams = {
      files: videos.map((v) => v.file),
      videoDurations: videos.map((v) => v.durationSeconds),
      style,
      mode: "reel" as const,
      maxReelSeconds: 60,
      bestMoments: analysis.bestMoments,
      introClip: routeIntroClip ?? undefined,
      outroClip: gearSummaryClip ?? undefined,
      quality: qualityForPlan(),
      renderSpeedProfile,
      watermark: isFree,
      videoAudioEnabled,
      keepOriginalAudio: !sportAudioDisabled,
      reelTitle: {
        text: reelTitle.trim(),
        font: reelTitleFont,
        size: reelTitleSize,
        color: reelTitleColor,
      },
      overlayTexts: sportOverlayTexts,
      overlayFonts,
      overlaySizes,
      overlayColors,
      gpxStats,
      gpxPoints,
      routeFocusPoints,
      routeLabel,
      sportTelemetry,
      preserveRouteIntro: false,
      openerHookText: hookTextForThisRender,
      customTextOverlays: storyTextsForThisRender,
      metadataCardLines,
      emotionalStory: analysis.emotionalStory,
      adventureSetupOverlay: adventureOverlay,
    };

    (async () => {
      setRenderProgress(null);
      setRenderError(null);

      try {
        const progressCallbacks = {
          onProgress: (ratio: number) => {
            if (cancelled) return;
            setRenderProgress((current) => {
              const previous = typeof current === "number" && Number.isFinite(current) ? current : 0;
              const next = Number.isFinite(ratio) ? Math.max(previous, ratio) : previous;
              return next;
            });
          },
          onPhaseChange: (label: string) => {
            if (cancelled) return;
            setRenderPhase(label);
          },
        };

        let result: Awaited<ReturnType<typeof buildMontage>> | null = null;
        let lastError: unknown = null;

        try {
          result = await buildMontage({
            ...baseParams,
            ...progressCallbacks,
          });
        } catch (error) {
          lastError = error;
        }

        if (!result && (routeIntroClip || gearSummaryClip)) {
          setRenderPhase("Recovering render without optional intro/outro clips…");
          try {
            result = await buildMontage({
              ...baseParams,
              introClip: undefined,
              outroClip: undefined,
              preserveRouteIntro: false,
              ...progressCallbacks,
            });
          } catch (error) {
            lastError = error;
          }
        }

        if (!result) {
          setRenderPhase("Recovering render without source audio…");
          try {
            result = await buildMontage({
              ...baseParams,
              keepOriginalAudio: false,
              videoAudioEnabled: videos.map(() => false),
              ...progressCallbacks,
            });
          } catch (error) {
            lastError = error;
          }
        }

        if (!result) {
          const fallbackMessage = lastError instanceof Error ? lastError.message : "Unknown render error.";
          const wrappedError = new Error(`Montage render failed. ${fallbackMessage}`);
          console.error("[render] buildMontage failed", lastError ?? wrappedError);
          throw wrappedError;
        }

        if (cancelled) return;
        setMontage(result);
        setRenderedHookText(hookTextForThisRender);
        setRenderedStoryTexts(storyTextsForThisRender);
        setRenderedAdventureOverlaySignature(adventureOverlaySignature);
        if (!creditConsumed) {
          consumeReelCredit();
          setCreditConsumed(true);
        }
        setRenderFallbackNotice(null);
        setStep("preview");
      } catch (e) {
        if (cancelled) return;
        setMontage(null);
        const errorMessage = e instanceof Error ? e.message : String(e);
        setRenderError(`Le montage n’a pas pu être rendu sur cet appareil. (${errorMessage})`);
        setRenderFallbackNotice(`Couldn't render the montage on this device. (${errorMessage})`);
        setStep("render");
      }
    })().finally(() => {
      renderInProgressRef.current = false;
      if (activeRenderSignature === renderSignature) {
        activeRenderSignature = null;
      }
    });

    return () => {
      if (!renderInProgressRef.current) {
        cancelled = true;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, videos, analysis, style, routeIntroClip, hasRouteIntro, routeIntroStatus, gearSummaryClip, isFree, shouldRenderGearSummary, gearSummaryStatus, renderGateTimedOut, selectedOverlayTextKey, reelTitleKey]);

  // Re-runs the render with whatever hook text is currently selected —
  // used when the user changes their hook pick/custom text on the Preview
  // screen *after* the first render, so that choice actually ends up baked
  // into the exported MP4 instead of only ever showing in the live preview.
  const regenerateWithCurrentHook = () => {
    setStep("render");
  };

  const retryRender = () => {
    setStep("analyze");
    setTimeout(() => setStep("render"), 0);
  };

  const skipRenderFallback = () => {
    if (videos.length === 0) return;
    setMontage(null);
    setRenderFallbackNotice(null);
    consumeReelCredit();
    setStep("preview");
  };

  const resetAll = () => {
    setVideos([]);
    setStyle(null);
    setAnalysis(null);
    setSelectedHookId("");
    setGearSelections(DEFAULT_GEAR_SELECTIONS);
    setGearPortraitFile(null);
    setReelTitle("");
    setReelTitleFont("cinematic");
    setReelTitleSize("md");
    setReelTitleColor("white");
    setOverlayTexts(["", "", ""]);
    setRouteIntroClip(null);
    setHasRouteIntro(false);
    setRouteIntroStatus("idle");
    setRouteIntroPoints(null);
    setRouteIntroStats(null);
    setRouteIntroLabels(null);
    clearGearSummaryClip("idle");
    setMontage(null);
    setGpxStats(null);
    setRouteLabel(null);
    setGpxPoints(null);
    setRouteFocusPoints(null);
    setAdventureSetup(createEmptyAdventureSetup());
    setAdventureSetupStatus("Not saved yet");
    setAdventureSetupReady(false);
    setReelTitle("");
    setRenderedHookText("");
    setRenderedAdventureOverlaySignature("");
    setCreditConsumed(false);
    setRenderFallbackNotice(null);
    setRenderError(null);
    setStep("upload");
  };

  const handleGearPortraitChange = (file: File | null) => {
    setGearPortraitFile(file);
    const nextSummary = buildGearSummaryEntries(gearSelections);
    clearGearSummaryClip(nextSummary.length > 0 || !!file ? "rendering" : "idle");
  };

  const handleGearBrandChange = (key: keyof typeof gearSelections, brand: string) => {
    setGearSelections((current) => {
      const next = {
        ...current,
        [key]: {
          brand,
          model: "",
          customModel: "",
        },
      };
      const nextSummary = buildGearSummaryEntries(next);
      clearGearSummaryClip(nextSummary.length > 0 || !!gearPortraitFile ? "rendering" : "idle");
      return next;
    });
  };

  const handleGearModelChange = (key: keyof typeof gearSelections, model: string) => {
    setGearSelections((current) => {
      const next = {
        ...current,
        [key]: {
          ...current[key],
          model: current[key].model === model ? "" : model,
          customModel: "",
        },
      };
      const nextSummary = buildGearSummaryEntries(next);
      clearGearSummaryClip(nextSummary.length > 0 || !!gearPortraitFile ? "rendering" : "idle");
      return next;
    });
  };

  const handleCustomGearModelChange = (key: keyof typeof gearSelections, value: string) => {
    setGearSelections((current) => {
      const next = {
        ...current,
        [key]: {
          ...current[key],
          customModel: value,
        },
      };
      const nextSummary = buildGearSummaryEntries(next);
      clearGearSummaryClip(nextSummary.length > 0 || !!gearPortraitFile ? "rendering" : "idle");
      return next;
    });
  };

  const previewUrl = montage?.url ?? videos[0]?.previewUrl ?? "";
  const combinedName = videos.length > 1 ? `${videos.length}-clips-montage` : videos[0]?.name ?? "reel";
  const requiresMapIntro = hasRouteIntro;
  const renderPhaseLabel =
    hasRouteIntro && routeIntroStatus === "rendering" && routeIntroClip === null
      ? copy.render.processingRoute
      : shouldRenderGearSummary && gearSummaryStatus === "rendering" && gearSummaryClip === null
      ? copy.render.processingGear
      : renderPhase
        ? renderPhase
      : renderProgress !== null
        ? copy.render.processingCuts
      : copy.render.loading;

  return (
    <AppShell onOpenPricing={() => setPricingOpen(true)}>
      <StepContent isVisible={step === "upload"}>
          <StepBar step={step} />
          <HeroSection />

        <MobileAccordionSection
          title={copy.reelName.title}
          description={copy.reelName.description}
          open={mobileSectionOpen.reelName}
          onToggle={() => setMobileSectionOpen((current) => ({ ...current, reelName: !current.reelName }))}
          compact={isCompactMobile}
         >
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <ReelNamePanel
              reelTitle={reelTitle}
              reelTitleFont={reelTitleFont}
              reelTitleSize={reelTitleSize}
              reelTitleColor={reelTitleColor}
              onChangeReelTitle={setReelTitle}
              onChangeReelTitleFont={setReelTitleFont}
              onChangeReelTitleSize={setReelTitleSize}
              onChangeReelTitleColor={setReelTitleColor}
            />
          </div>
        </MobileAccordionSection>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-white/85">{copy.upload.title}</h2>
          <p className="mb-2 text-xs text-white/45">{copy.upload.description}</p>
          <VideoUploader
            videos={videos}
            onChange={setVideos}
            maxVideos={3}
          />
        </div>

        {/* Route source: GPX import OR location-based route planner. */}
        <MobileAccordionSection
          title={copy.route.title}
          description={copy.route.description}
          open={mobileSectionOpen.route}
          onToggle={() => setMobileSectionOpen((current) => ({ ...current, route: !current.route }))}
          compact={isCompactMobile}
        >
          <RouteSourceSelector
            videos={videos}
            onRouteDataChange={({ points, stats, labels }) => {
              setRouteIntroPoints(points);
              setRouteIntroStats(stats);
              setRouteIntroLabels(labels);
              const available = !!points && points.length > 1;
              setHasRouteIntro(available);
              setRouteIntroClip(null);
              setRouteIntroStatus(available ? "rendering" : "idle");
              if (available) {
                setRouteIntroGeneration((current) => current + 1);
              }
            }}
            onLockedClick={() =>
              showUpgrade(copy.route.lockedTitle, copy.route.lockedMessage)
            }
          />
        </MobileAccordionSection>

        <MobileAccordionSection
          title={copy.hook.title}
          description={copy.hook.description}
          open={mobileSectionOpen.hook}
          onToggle={() => setMobileSectionOpen((current) => ({ ...current, hook: !current.hook }))}
          compact={isCompactMobile}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        >
          <HookCaptionPanel
            overlayTexts={overlayTexts}
            overlayFonts={overlayFonts}
            overlaySizes={overlaySizes}
            overlayColors={overlayColors}
            onChangeOverlayText={(index, value) =>
              setOverlayTexts((current) => {
                const next = [...current] as [string, string, string];
                next[index] = value;
                return next;
              })
            }
            onChangeOverlayFont={(index, value) =>
              setOverlayFonts((current) => {
                const next = [...current] as [ReelTitleFont, ReelTitleFont, ReelTitleFont];
                next[index] = value;
                return next;
              })
            }
            onChangeOverlaySize={(index, value) =>
              setOverlaySizes((current) => {
                const next = [...current] as [ReelTitleSize, ReelTitleSize, ReelTitleSize];
                next[index] = value;
                return next;
              })
            }
            onChangeOverlayColor={(index, value) =>
              setOverlayColors((current) => {
                const next = [...current] as [ReelTitleColor, ReelTitleColor, ReelTitleColor];
                next[index] = value;
                return next;
              })
            }
          />
        </MobileAccordionSection>

        <MobileAccordionSection
          title={copy.gear.title}
          description={copy.gear.photoDescription}
          open={mobileSectionOpen.gear}
          onToggle={() => setMobileSectionOpen((current) => ({ ...current, gear: !current.gear }))}
          compact={isCompactMobile}
        >
          <CreationExtrasPanel
            selections={gearSelections}
            portraitFile={gearPortraitFile}
            onChangePortraitFile={handleGearPortraitChange}
            onSelectGearBrand={handleGearBrandChange}
            onSelectGearModel={handleGearModelChange}
            onChangeCustomGearModel={handleCustomGearModelChange}
          />
        </MobileAccordionSection>

        <button
          onClick={goToStyle}
          disabled={videos.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition disabled:cursor-not-allowed disabled:opacity-30"
        >
          {copy.common.chooseStyle} <ArrowRight className="h-4 w-4" />
        </button>
      </StepContent>

      <StepContent isVisible={step === "style"}>
        <StepBar step={step} />
        {!analysis ? (
          <div>
            <h2 className="mb-1 text-sm font-semibold text-white/85">{copy.styleText.pickTitle}</h2>
            <p className="mb-3 text-xs text-white/45">{copy.styleText.pickDescription}</p>
            <StyleSelector
              selected={style}
              onSelect={(nextStyle) => {
                if (weeklyLimitReached) {
                  showUpgrade(copy.pricing.title, copy.pricing.subtitle);
                  return;
                }
                setStyle(nextStyle);
                setStep("analyze");
              }}
              onLockedClick={() => showUpgrade(copy.styleText.pickTitle, copy.styleText.pickDescription)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
              <h2 className="mb-2 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-[-0.05em] text-white/90">{copy.styleText.equipmentTitle}</h2>
              <p className="max-w-[62ch] text-base leading-relaxed text-white/60">{copy.styleText.equipmentDescription}</p>
            </div>
            {isFree ? (
              <button
                onClick={() =>
                  showUpgrade("Reel titles are a Pro feature", "Add a custom animated title screen to your Reel with Creator Pro and above.")
                }
                className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-left text-xs text-white/40"
              >
                Unlock custom Reel titles with Pro
              </button>
            ) : (
              <input
                value={reelTitle}
                onChange={(e) => setReelTitle(e.target.value.slice(0, 60))}
                placeholder="Write your Reel title…"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-sm text-white/85 placeholder:text-white/30 focus:border-fuchsia-400/40 focus:outline-none"
              />
            )}
          </div>
        )}

        <div className="flex gap-2">
          <BackButton onClick={() => setStep("upload")} />
          {!analysis ? (
            <button
              onClick={startAnalysis}
              disabled={!style}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition disabled:cursor-not-allowed disabled:opacity-30"
            >
              {copy.common.analyzeVideos} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={startRender}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition"
            >
              {copy.common.generateReel} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </StepContent>

      <StepContent isVisible={step === "analyze"}>
        <AIAnalysisPanel videos={videos} onComplete={handleAnalysisComplete} gpxPoints={gpxPoints} />
      </StepContent>

      <StepContent isVisible={step === "render" && style !== null}>
        {style && (
          <>
            <RenderPanel
              progress={renderProgress}
              phaseLabel={renderPhaseLabel}
            />
            {hasRouteIntro && (
              <div className="space-y-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-3 text-xs text-cyan-100/90">
                <p className="font-semibold uppercase tracking-[0.12em] text-cyan-100/85">Map intro</p>
                <p>
                  {routeIntroStatus === "rendering" && "Generating route map clip…"}
                  {routeIntroStatus === "ready" && "Route map clip is ready and will be included at the beginning of the reel."}
                  {routeIntroStatus === "error" && "Route map clip failed to render."}
                  {routeIntroStatus === "idle" && "Waiting for route map generation."}
                </p>
              </div>
            )}
            {renderError && (
              <div className="space-y-2 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-300">
                <p>{renderError}</p>
                <div className="flex gap-2">
                  <button onClick={retryRender} className="flex-1 rounded-xl bg-white/10 py-2 font-semibold text-white/85 hover:bg-white/15">
                    {copy.render.retry}
                  </button>
                  {!requiresMapIntro && (
                    <button onClick={skipRenderFallback} className="flex-1 rounded-xl bg-white/5 py-2 font-semibold text-white/60 hover:bg-white/10">
                      {copy.render.continueRaw}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </StepContent>

      <StepContent isVisible={step === "preview" && analysis !== null && videos.length > 0}>
          {analysis && (
            <>
              <StepBar step={step} />

              <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2.5 text-xs text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                {montage ? copy.preview.ready : copy.preview.readyAlt}
              </div>

              <ReelPreview
                videoUrl={previewUrl}
                videoBlob={montage?.blob}
                style={analysis.style}
                hookText={selectedHookText}
                bestMoments={analysis.bestMoments}
                watermark={isFree && !montage}
                reelTitle={reelTitle.trim()}
                reelTitleFont={reelTitleFont}
                reelTitleSize={reelTitleSize}
                reelTitleColor={reelTitleColor}
                overlayTexts={sportOverlayTexts}
                overlayFonts={overlayFonts}
                overlaySizes={overlaySizes}
                overlayColors={overlayColors}
                introDurationSeconds={routeIntroClip?.durationSeconds ?? 0}
                outroDurationSeconds={analysis.style === "sport" ? Math.min(gearSummaryClip?.durationSeconds ?? 0, 3) : gearSummaryClip?.durationSeconds ?? 0}
                montageInfo={montage ? { clipCount: montage.clipCount, durationSeconds: montage.durationSeconds } : undefined}
                routeLabel={routeLabel}
                sportTelemetry={sportTelemetry}
              />

              <Section title={copy.common.exportLabel}>
                <ExportPanel videoUrl={previewUrl} videoBlob={montage?.blob ?? null} videoName={combinedName} onLockedClick={() => setPricingOpen(true)} />
              </Section>

              <button
                onClick={resetAll}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] py-3.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99]"
              >
                <RotateCcw className="h-4 w-4" />
                {copy.common.startNew}
              </button>
            </>
          )}
      </StepContent>

      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
      {routeIntroPoints && routeIntroPoints.length > 1 && (
        <RouteMapIntro
          key={`${routeIntroGeneration}-${routeIntroCinematicProfile}`}
          points={routeIntroPoints}
          routeStats={routeIntroStats}
          initialLabels={routeIntroLabels ?? undefined}
          cinematicProfile={routeIntroCinematicProfile}
          generationToken={routeIntroGeneration}
          onClipReady={setRouteIntroClip}
          onStatusChange={setRouteIntroStatus}
          hideUi
        />
      )}
      <UpgradePrompt
        open={!!upgradePrompt}
        title={upgradePrompt?.title ?? ""}
        message={upgradePrompt?.message ?? ""}
        onClose={() => setUpgradePrompt(null)}
        onUpgrade={() => {
          setUpgradePrompt(null);
          setPricingOpen(true);
        }}
      />
    </AppShell>
  );
}

function MobileAccordionSection({
  title,
  description,
  open,
  onToggle,
  compact,
  className,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  compact: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const content = (
    <div className={className ?? ""}>
      {children}
    </div>
  );

  if (!compact) {
    return (
      <div>
        <h2 className="mb-2 text-sm font-semibold text-white/85">{title}</h2>
        {description && <p className="mb-2 text-xs text-white/45">{description}</p>}
        {content}
      </div>
    );
  }

  if (open) {
    return (
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.16)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[clamp(1.5rem,5vw,2.2rem)] font-semibold tracking-[-0.05em] text-white/90">{title}</div>
            {description && <div className="mt-1 text-sm leading-relaxed text-white/60">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.06]"
            aria-label={title}
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 rotate-180" aria-hidden="true">
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div>{content}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/[0.02] active:bg-white/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-white/90">{title}</div>
          {description && <div className="mt-0.5 line-clamp-1 text-[10px] text-white/45">{description}</div>}
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-all duration-220">
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
    </div>
  );
}

function StepBar({ step }: { step: AppStep }) {
  const { copy } = useLocale();
  const currentIndex = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {STEP_ORDER.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-1.5">
          <div className={"h-1 flex-1 rounded-full " + (i <= currentIndex ? "brand-gradient" : "bg-white/10")} />
        </div>
      ))}
      <span className="ml-1 shrink-0 text-[10px] font-medium text-white/40">{copy.stepLabel(step)}</span>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const { copy } = useLocale();
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5 text-white/60 transition hover:bg-white/[0.05]"
      aria-label={copy.common.back}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="mb-2 text-sm font-semibold text-white/85">{title}</h2>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function StepContent({ isVisible, children }: { isVisible: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="step-content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="space-y-4 sm:space-y-5"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
