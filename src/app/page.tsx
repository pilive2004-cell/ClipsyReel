"use client";

import { useEffect, useRef, useState } from "react";
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
import ReelNamePanel from "@/components/ReelNamePanel";
import RouteSourceSelector from "@/components/RouteSourceSelector";
import PricingModal from "@/components/PricingModal";
import UpgradePrompt from "@/components/UpgradePrompt";
import ExportPanel from "@/components/ExportPanel";
import CreationExtrasPanel from "@/components/CreationExtrasPanel";
import RouteMapIntro, { RouteIntroClip } from "@/components/gpx/RouteMapIntro";

import { usePlan } from "@/lib/plan-context";
import { useLocale } from "@/lib/i18n";
import { generateGearSummaryClip, GearSummaryClip } from "@/lib/gear-summary-clip";
import { buildAnalysisResult, generateMockAnalysisMulti } from "@/data/mock";
import { buildMontage, preloadRenderPipeline, qualityForPlan } from "@/lib/video-engine";
import { buildGearSummaryEntries, DEFAULT_GEAR_SELECTIONS } from "@/data/gearCatalog";
import { AppStep, BestMoment, GpxRouteStats, GpxTrackPoint, MontageResult, ReelAnalysisResult, ReelStyle, ReelTitleColor, ReelTitleFont, ReelTitleSize, RouteLabel, UploadedVideo } from "@/types";

const STEP_ORDER: AppStep[] = ["upload", "style", "analyze", "render", "preview"];

export default function Home() {
  const { isFree, reelsUsedThisWeek, weeklyFreeLimit, consumeReelCredit } = usePlan();
  const { copy } = useLocale();

  const [step, setStep] = useState<AppStep>("upload");
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [style, setStyle] = useState<ReelStyle | null>(null);
  const [analysis, setAnalysis] = useState<ReelAnalysisResult | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string>("");
  const [gearSelections, setGearSelections] = useState(DEFAULT_GEAR_SELECTIONS);
  const [gearPortraitFile, setGearPortraitFile] = useState<File | null>(null);
  const [reelTitle, setReelTitle] = useState("");
  const [reelTitleFont, setReelTitleFont] = useState<ReelTitleFont>("cinematic");
  const [reelTitleSize, setReelTitleSize] = useState<ReelTitleSize>("md");
  const [reelTitleColor, setReelTitleColor] = useState<ReelTitleColor>("white");
  const [overlayTexts, setOverlayTexts] = useState<[string, string, string]>(["", "", ""]);
  const [overlayFonts, setOverlayFonts] = useState<[ReelTitleFont, ReelTitleFont, ReelTitleFont]>(["cinematic", "cinematic", "cinematic"]);
  const [overlaySizes, setOverlaySizes] = useState<[ReelTitleSize, ReelTitleSize, ReelTitleSize]>(["md", "md", "md"]);
  const [overlayColors, setOverlayColors] = useState<[ReelTitleColor, ReelTitleColor, ReelTitleColor]>(["white", "white", "white"]);
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
  const renderPipelineWarmedRef = useRef(false);

  const showUpgrade = (title: string, message: string) => setUpgradePrompt({ title, message });

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
    setStep("render");
  };

  const equipmentSummary = buildGearSummaryEntries(gearSelections);
  const selectedOverlayTexts = overlayTexts.filter((text) => text.trim().length > 0);
  const selectedOverlayTextKey = selectedOverlayTexts.join("\n");
  const reelTitleKey = `${reelTitle.trim()}|${reelTitleFont}|${reelTitleSize}|${reelTitleColor}`;

  const clearGearSummaryClip = (nextStatus: "idle" | "rendering" | "ready" | "error" = "idle") => {
    setGearSummaryStatus(nextStatus);
    setGearSummaryClip((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => {
    let cancelled = false;

    if (equipmentSummary.length === 0 && !gearPortraitFile) return;

    queueMicrotask(() => {
      if (cancelled) return;

      void generateGearSummaryClip({ selections: gearSelections, portrait: gearPortraitFile ?? undefined })
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
  }, [equipmentSummary.length, gearSelections, gearPortraitFile]);

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
          reelTitle: {
            text: reelTitle.trim(),
            font: reelTitleFont,
            size: reelTitleSize,
            color: reelTitleColor,
          },
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
  }, [step, videos, analysis, style, routeIntroClip, hasRouteIntro, routeIntroStatus, gearSummaryClip, isFree, equipmentSummary.length, gearSummaryStatus, selectedOverlayTextKey, reelTitleKey]);

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
    setStep("upload");
  };

  const selectedHookText = analysis?.hooks.find((h) => h.id === selectedHookId)?.text ?? "";
  const previewUrl = montage?.url ?? videos[0]?.previewUrl ?? "";
  const combinedName = videos.length > 1 ? `${videos.length}-clips-montage` : videos[0]?.name ?? "reel";
  const requiresMapIntro = hasRouteIntro;
  const renderPhaseLabel =
    hasRouteIntro && routeIntroStatus === "rendering" && routeIntroClip === null
      ? copy.render.processingRoute
      : equipmentSummary.length > 0 && gearSummaryStatus === "rendering" && gearSummaryClip === null
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

          <div>
            <h2 className="mb-2 text-sm font-semibold text-white/85">{copy.reelName.title}</h2>
            <p className="mb-2 text-xs text-white/45">{copy.reelName.description}</p>
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
          </div>

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
          <div>
            <h2 className="mb-2 text-sm font-semibold text-white/85">{copy.route.title}</h2>
            <p className="mb-2 text-xs text-white/45">{copy.route.description}</p>
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
                showUpgrade(copy.route.lockedTitle, copy.route.lockedMessage)
              }
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="mb-2 text-sm font-semibold text-white/85">{copy.hook.title}</h2>
            <p className="mb-3 text-xs text-white/45">{copy.hook.description}</p>
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
          </div>

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
                onSelect={setStyle}
                onLockedClick={() =>
                  showUpgrade(copy.styleText.pickTitle, copy.styleText.pickDescription)
                }
              />
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div>
                <h2 className="mb-1 text-sm font-semibold text-white/85">{copy.styleText.equipmentTitle}</h2>
                <p className="text-xs text-white/45">{copy.styleText.equipmentDescription}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75">
                <span className="text-white/45">{copy.styleText.selectedStyle}</span>
                <span className="font-semibold text-white/90">{style ? copy.style(style).label : ""}</span>
              </div>
            </div>
          )}

          {analysis && (
            <CreationExtrasPanel
            selections={gearSelections}
            portraitFile={gearPortraitFile}
            onChangePortraitFile={(file) => {
            setGearPortraitFile(file);
            const nextSummary = buildGearSummaryEntries(gearSelections);
            clearGearSummaryClip(nextSummary.length > 0 || !!file ? "rendering" : "idle");
            }}
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
              clearGearSummaryClip(nextSummary.length > 0 || !!gearPortraitFile ? "rendering" : "idle");
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
                clearGearSummaryClip(nextSummary.length > 0 || !!gearPortraitFile ? "rendering" : "idle");
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
                clearGearSummaryClip(nextSummary.length > 0 || !!gearPortraitFile ? "rendering" : "idle");
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
        <AIAnalysisPanel videos={videos} onComplete={handleAnalysisComplete} />
      </StepContent>

      <StepContent isVisible={step === "render" && style !== null}>
        {style && (
          <>
            <RenderPanel progress={renderProgress} phaseLabel={renderPhaseLabel} styleLabel={style ? copy.style(style).label : ""} />
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
                overlayTexts={selectedOverlayTexts}
                overlayFonts={overlayFonts}
                overlaySizes={overlaySizes}
                overlayColors={overlayColors}
                introDurationSeconds={routeIntroClip?.durationSeconds ?? 0}
                outroDurationSeconds={gearSummaryClip?.durationSeconds ?? 0}
                montageInfo={montage ? { clipCount: montage.clipCount, durationSeconds: montage.durationSeconds } : undefined}
              />

              <Section title={copy.common.exportLabel}>
                <ExportPanel videoUrl={previewUrl} videoName={combinedName} onLockedClick={() => setPricingOpen(true)} />
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
          className="space-y-5"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
