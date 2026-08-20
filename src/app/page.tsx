"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";

import AppShell from "@/components/AppShell";
import HeroSection from "@/components/HeroSection";
import VideoUploader from "@/components/VideoUploader";
import StyleSelector from "@/components/StyleSelector";
import AIAnalysisPanel from "@/components/AIAnalysisPanel";
import RenderPanel from "@/components/RenderPanel";
import ReelPreview from "@/components/ReelPreview";
import HookCaptionPanel from "@/components/HookCaptionPanel";
import RouteSourceSelector from "@/components/RouteSourceSelector";
import PricingModal from "@/components/PricingModal";
import UpgradePrompt from "@/components/UpgradePrompt";
import ExportPanel from "@/components/ExportPanel";
import CreationExtrasPanel from "@/components/CreationExtrasPanel";
import RouteMapIntro, { RouteIntroClip } from "@/components/gpx/RouteMapIntro";

import { usePlan } from "@/lib/plan-context";
import { generateGearSummaryClip, GearSummaryClip } from "@/lib/gear-summary-clip";
import { buildAnalysisResult, generateMockAnalysisMulti, STYLES } from "@/data/mock";
import { buildMontage, qualityForPlan } from "@/lib/video-engine";
import { buildGearSummaryEntries, DEFAULT_GEAR_SELECTIONS } from "@/data/gearCatalog";
import { AppStep, BestMoment, GpxRouteStats, GpxTrackPoint, MontageResult, ReelAnalysisResult, ReelStyle, RouteLabel, UploadedVideo } from "@/types";

const STEP_ORDER: AppStep[] = ["upload", "style", "analyze", "render", "preview"];
const STEP_LABELS: Record<AppStep, string> = {
  upload: "Upload",
  style: "Style",
  analyze: "Analyze",
  render: "Edit",
  preview: "Preview",
};

export default function Home() {
  const { isFree, reelsUsedThisWeek, weeklyFreeLimit, consumeReelCredit } = usePlan();

  const [step, setStep] = useState<AppStep>("upload");
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [style, setStyle] = useState<ReelStyle | null>(null);
  const [analysis, setAnalysis] = useState<ReelAnalysisResult | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string>("");
  const [gearSelections, setGearSelections] = useState(DEFAULT_GEAR_SELECTIONS);
  const [overlayTexts, setOverlayTexts] = useState<[string, string, string]>(["", "", ""]);
  const [routeIntroClip, setRouteIntroClip] = useState<RouteIntroClip | null>(null);
  const [hasRouteIntro, setHasRouteIntro] = useState(false);
  const [routeIntroStatus, setRouteIntroStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [routeIntroPoints, setRouteIntroPoints] = useState<GpxTrackPoint[] | null>(null);
  const [routeIntroStats, setRouteIntroStats] = useState<GpxRouteStats | null>(null);
  const [routeIntroLabels, setRouteIntroLabels] = useState<RouteLabel[] | null>(null);
  const [gearSummaryClip, setGearSummaryClip] = useState<GearSummaryClip | null>(null);
  const [gearSummaryStatus, setGearSummaryStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");

  const [montage, setMontage] = useState<MontageResult | null>(null);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [renderPhase, setRenderPhase] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);

  const [pricingOpen, setPricingOpen] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<{ title: string; message: string } | null>(null);

  const showUpgrade = (title: string, message: string) => setUpgradePrompt({ title, message });

  const weeklyLimitReached = isFree && reelsUsedThisWeek >= weeklyFreeLimit;

  const goToStyle = () => setStep("style");

  const startAnalysis = () => {
    if (weeklyLimitReached) {
      showUpgrade(
        "You've used this week's free Reel",
        "Free plan includes 1 Reel per week. Upgrade to Creator Pro for 30 Reels a month — no waiting."
      );
      return;
    }
    setStep("analyze");
  };

  const startRender = () => {
    if (!analysis || !style) return;
    setStep("render");
  };

  const equipmentSummary = buildGearSummaryEntries(gearSelections);
  const selectedOverlayTexts = overlayTexts.filter((text) => text.trim().length > 0);
  const selectedOverlayTextKey = selectedOverlayTexts.join("\n");

  const clearGearSummaryClip = (nextStatus: "idle" | "rendering" | "ready" | "error" = "idle") => {
    setGearSummaryStatus(nextStatus);
    setGearSummaryClip((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => {
    let cancelled = false;

    if (equipmentSummary.length === 0) return;

    queueMicrotask(() => {
      if (cancelled) return;

      void generateGearSummaryClip({ selections: gearSelections })
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
  }, [equipmentSummary.length, gearSelections]);

  useEffect(() => {
    return () => {
      if (gearSummaryClip?.url) URL.revokeObjectURL(gearSummaryClip.url);
    };
  }, [gearSummaryClip]);

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
        ? buildAnalysisResult(combinedName, totalDuration, style, realBestMoments)
        : generateMockAnalysisMulti(videos, style);
    setAnalysis(result);
    setSelectedHookId("");
    setStep("style");
  };

  // Runs the real ffmpeg.wasm montage (cuts + Ken Burns zoom + randomized,
  // style-matched xfade transitions) across all uploaded videos, once
  // analysis has produced best-moment timestamps to cut from.
  useEffect(() => {
    if (step !== "render" || videos.length === 0 || !analysis || !style) return;
    if (hasRouteIntro && routeIntroStatus === "rendering" && routeIntroClip === null) {
      return;
    }
    if (hasRouteIntro && (!routeIntroClip || routeIntroStatus === "error")) {
      queueMicrotask(() =>
        setRenderError("The map intro could not be rendered, so the reel export has been stopped instead of producing a reel without the map.")
      );
      return;
    }
    if (equipmentSummary.length > 0 && gearSummaryStatus === "rendering" && gearSummaryClip === null) {
      return;
    }
    let cancelled = false;

    (async () => {
      setRenderProgress(null);
      setRenderError(null);

      try {
        const result = await buildMontage({
          files: videos.map((v) => v.file),
          videoDurations: videos.map((v) => v.durationSeconds),
          style,
          mode: "reel",
          bestMoments: analysis.bestMoments,
          // The final reel must start with the generated route-map intro when a
          // valid GPX track exists. We stop export earlier if this clip could
          // not be rendered, rather than silently exporting a reel without it.
          introClip: routeIntroClip ?? undefined,
          outroClip: gearSummaryClip ?? undefined,
          quality: qualityForPlan(),
          renderSpeedProfile: "fast",
          watermark: isFree,
          videoAudioEnabled: videos.map((v) => v.keepAudio),
          overlayTexts: selectedOverlayTexts,
          onProgress: (ratio) => {
            if (cancelled) return;
            setRenderProgress(ratio);
          },
          onPhaseChange: (label) => {
            if (cancelled) return;
            setRenderPhase(label);
          },
        });
        if (cancelled) return;
        setMontage(result);
        consumeReelCredit();
        setStep("preview");
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setRenderError("Couldn't render the montage on this device. You can retry, or continue with the raw clip.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, videos, analysis, style, routeIntroClip, hasRouteIntro, routeIntroStatus, gearSummaryClip, isFree, equipmentSummary.length, gearSummaryStatus, selectedOverlayTextKey]);

  const retryRender = () => {
    setStep("analyze");
    setTimeout(() => setStep("render"), 0);
  };

  const skipRenderFallback = () => {
    if (videos.length === 0) return;
    setMontage(null);
    consumeReelCredit();
    setStep("preview");
  };

  const resetAll = () => {
    setVideos([]);
    setStyle(null);
    setAnalysis(null);
    setSelectedHookId("");
    setGearSelections(DEFAULT_GEAR_SELECTIONS);
    setOverlayTexts(["", "", ""]);
    setRouteIntroClip(null);
    setHasRouteIntro(false);
    setRouteIntroStatus("idle");
    setRouteIntroPoints(null);
    setRouteIntroStats(null);
    setRouteIntroLabels(null);
    clearGearSummaryClip("idle");
    setMontage(null);
    setStep("upload");
  };

  const selectedHookText = analysis?.hooks.find((h) => h.id === selectedHookId)?.text ?? "";
  const previewUrl = montage?.url ?? videos[0]?.previewUrl ?? "";
  const combinedName = videos.length > 1 ? `${videos.length}-clips-montage` : videos[0]?.name ?? "reel";
  const requiresMapIntro = hasRouteIntro;
  const renderPhaseLabel =
    hasRouteIntro && routeIntroStatus === "rendering" && routeIntroClip === null
      ? "Preparing animated route map…"
      : equipmentSummary.length > 0 && gearSummaryStatus === "rendering" && gearSummaryClip === null
        ? "Preparing equipment summary card…"
      : renderPhase
        ? renderPhase
      : renderProgress !== null
        ? "Cutting, zooming & cross-fading your clips…"
        : "Loading editing engine…";

  return (
    <AppShell onOpenPricing={() => setPricingOpen(true)}>
      <div className={step === "upload" ? "space-y-5" : "hidden"}>
          <HeroSection />

          <div>
            <h2 className="mb-2 text-sm font-semibold text-white/85">1. Upload your video{videos.length > 1 ? "s" : ""}</h2>
            <p className="mb-2 text-xs text-white/45">Upload up to 3 clips — they&apos;ll be combined into one montage.</p>
            <VideoUploader
              videos={videos}
              onChange={setVideos}
              maxVideos={3}
            />
          </div>

          {/* Route source: GPX import OR location-based route planner. */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-white/85">Route (optional)</h2>
            <p className="mb-2 text-xs text-white/45">Import a GPX file or plan a route from city names to add a cinematic map intro to your reel.</p>
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
              }}
              onLockedClick={() =>
                showUpgrade("GPX route maps are a Pro feature", "Upload your ride/hike GPX file or plan a route from city names with Creator Pro.")
              }
            />
          </div>

          <button
            onClick={goToStyle}
            disabled={videos.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition disabled:cursor-not-allowed disabled:opacity-30"
          >
            Choose a style <ArrowRight className="h-4 w-4" />
          </button>
      </div>

      <div className={step === "style" ? "space-y-5" : "hidden"}>
          <StepBar step={step} />
          <div>
            <h2 className="mb-1 text-sm font-semibold text-white/85">2. Pick a Reel style</h2>
            <p className="mb-3 text-xs text-white/45">This shapes cuts, transitions, zoom pacing, hook tone and music mood.</p>
            <StyleSelector
              selected={style}
              onSelect={setStyle}
              onLockedClick={() =>
                showUpgrade("This style is a Pro feature", "Cinematic, Sport and Luxury styles are available on Creator Pro and above.")
              }
            />
          </div>

          {analysis && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div>
                <h2 className="text-sm font-semibold text-white/85">Hook text</h2>
                <p className="mt-1 text-xs text-white/45">Ajoute ici tes 3 textes personnalisés.</p>
              </div>
              <HookCaptionPanel
                overlayTexts={overlayTexts}
                onChangeOverlayText={(index, value) =>
                  setOverlayTexts((current) => {
                    const next = [...current] as [string, string, string];
                    next[index] = value;
                    return next;
                  })
                }
              />
            </div>
          )}

          {analysis && (
            <CreationExtrasPanel
            selections={gearSelections}
            onSelectGearBrand={(key, brand) =>
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
                clearGearSummaryClip(nextSummary.length > 0 ? "rendering" : "idle");
                return next;
              })
            }
            onSelectGearModel={(key, model) =>
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
                clearGearSummaryClip(nextSummary.length > 0 ? "rendering" : "idle");
                return next;
              })
            }
            onChangeCustomGearModel={(key, value) =>
              setGearSelections((current) => {
                const next = {
                 ...current,
                 [key]: {
                   ...current[key],
                   customModel: value,
                 },
                };
                const nextSummary = buildGearSummaryEntries(next);
                clearGearSummaryClip(nextSummary.length > 0 ? "rendering" : "idle");
                return next;
              })
            }
            />
          )}

          <div className="flex gap-2">
            <BackButton onClick={() => setStep("upload")} />
            {!analysis ? (
              <button
                onClick={startAnalysis}
                disabled={!style}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition disabled:cursor-not-allowed disabled:opacity-30"
              >
                Analyze video{videos.length > 1 ? "s" : ""} <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={startRender}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition"
              >
                Generate Reel <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
      </div>

      {step === "analyze" && <AIAnalysisPanel videos={videos} onComplete={handleAnalysisComplete} />}

      {step === "render" && style && (
        <div className="space-y-4">
          <RenderPanel progress={renderProgress} phaseLabel={renderPhaseLabel} styleLabel={STYLES.find((s) => s.id === style)?.label ?? style} />
          {renderError && (
            <div className="space-y-2 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-300">
              <p>{renderError}</p>
              <div className="flex gap-2">
                <button onClick={retryRender} className="flex-1 rounded-xl bg-white/10 py-2 font-semibold text-white/85 hover:bg-white/15">
                  Retry
                </button>
                {!requiresMapIntro && (
                  <button onClick={skipRenderFallback} className="flex-1 rounded-xl bg-white/5 py-2 font-semibold text-white/60 hover:bg-white/10">
                    Continue with raw clip
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === "preview" && analysis && videos.length > 0 && (
        <div className="space-y-6">
          <StepBar step={step} />

          <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2.5 text-xs text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            {montage ? "Montage rendered — real cuts, zoom & transitions applied" : "Analysis complete — your Reel is ready to preview"}
          </div>

          <ReelPreview
            videoUrl={previewUrl}
            videoBlob={montage?.blob}
            style={analysis.style}
            hookText={selectedHookText}
            bestMoments={analysis.bestMoments}
            watermark={isFree && !montage}
            overlayTexts={selectedOverlayTexts}
            introDurationSeconds={routeIntroClip?.durationSeconds ?? 0}
            outroDurationSeconds={gearSummaryClip?.durationSeconds ?? 0}
            montageInfo={montage ? { clipCount: montage.clipCount, durationSeconds: montage.durationSeconds } : undefined}
          />

          <Section title="Export">
            <ExportPanel videoUrl={previewUrl} videoName={combinedName} onLockedClick={() => setPricingOpen(true)} />
          </Section>

          <button
            onClick={resetAll}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] py-3.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99]"
          >
            <RotateCcw className="h-4 w-4" />
            Start a new Reel
          </button>
        </div>
      )}

      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
      {routeIntroPoints && routeIntroPoints.length > 1 && (
        <RouteMapIntro
          points={routeIntroPoints}
          routeStats={routeIntroStats}
          initialLabels={routeIntroLabels ?? undefined}
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

function StepBar({ step }: { step: AppStep }) {
  const currentIndex = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {STEP_ORDER.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-1.5">
          <div className={"h-1 flex-1 rounded-full " + (i <= currentIndex ? "brand-gradient" : "bg-white/10")} />
        </div>
      ))}
      <span className="ml-1 shrink-0 text-[10px] font-medium text-white/40">{STEP_LABELS[step]}</span>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5 text-white/60 transition hover:bg-white/[0.05]"
      aria-label="Back"
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
