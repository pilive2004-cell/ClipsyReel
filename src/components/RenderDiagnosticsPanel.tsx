"use client";

import { useState } from "react";
import { Zap, BarChart3, AlertCircle } from "lucide-react";

interface RenderMetrics {
  totalDurationMs: number;
  phase1DurationMs: number;
  phase2DurationMs: number;
  hardwareCodec: string;
  gpuAvailable: boolean;
  segmentsCount: number;
  estimatedTimeRemaining: number;
  performanceScore: number; // 0-100
  bottlenecks: string[];
  recommendations: string[];
}

interface RenderDiagnosticsPanelProps {
  metrics: RenderMetrics | null;
  onQualityChange?: (quality: "preview" | "standard" | "premium") => void;
}

export default function RenderDiagnosticsPanel({
  metrics,
  onQualityChange,
}: RenderDiagnosticsPanelProps) {
  const [expandedBottleneck, setExpandedBottleneck] = useState<string | null>(null);

  if (!metrics) {
    return null;
  }

  const totalTime = metrics.totalDurationMs / 1000;
  const phase1Time = metrics.phase1DurationMs / 1000;
  const phase2Time = metrics.phase2DurationMs / 1000;
  const timePerSegment = metrics.segmentsCount > 0 ? phase1Time / metrics.segmentsCount : 0;

  // Calculate efficiency scores
  const gpuEfficiency = metrics.gpuAvailable ? 100 : 60; // GPU = 100%, CPU = 60%
  const qualityScore = Math.max(0, 100 - Math.abs(phase1Time - 15) * 2); // Target ~15s Phase 1
  const overallScore = (gpuEfficiency * 0.4 + qualityScore * 0.6);

  return (
    <div className="space-y-3 rounded-2xl border border-blue-400/20 bg-blue-400/[0.06] p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-300" />
        <h3 className="text-sm font-semibold text-blue-100">Render Diagnostics</h3>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-black/30 p-2">
          <p className="text-white/50">Total Time</p>
          <p className="text-lg font-bold text-white">{totalTime.toFixed(1)}s</p>
        </div>
        <div className="rounded-lg bg-black/30 p-2">
          <p className="text-white/50">Hardware</p>
          <p className="text-sm font-semibold text-blue-200">{metrics.hardwareCodec}</p>
        </div>
        <div className="rounded-lg bg-black/30 p-2">
          <p className="text-white/50">Phase 1 (Cuts)</p>
          <p className="text-lg font-bold text-white">{phase1Time.toFixed(1)}s</p>
          <p className="text-[10px] text-white/40">{timePerSegment.toFixed(1)}s/segment</p>
        </div>
        <div className="rounded-lg bg-black/30 p-2">
          <p className="text-white/50">Phase 2 (Compose)</p>
          <p className="text-lg font-bold text-white">{phase2Time.toFixed(1)}s</p>
        </div>
      </div>

      {/* Performance Score */}
      <div className="space-y-1 rounded-lg bg-black/30 p-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white">Performance Score</p>
          <p className="text-sm font-bold text-blue-200">{overallScore.toFixed(0)}/100</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/50">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-300 transition-all duration-300"
            style={{ width: `${overallScore}%` }}
          />
        </div>
      </div>

      {/* GPU Status */}
      <div
        className={`flex items-center gap-2 rounded-lg p-2 text-xs ${
          metrics.gpuAvailable ? "bg-emerald-400/10" : "bg-orange-400/10"
        }`}
      >
        <Zap className={`h-3.5 w-3.5 ${metrics.gpuAvailable ? "text-emerald-400" : "text-orange-400"}`} />
        <span className={metrics.gpuAvailable ? "text-emerald-200" : "text-orange-200"}>
          {metrics.gpuAvailable ? "GPU Acceleration Active" : "CPU Mode (consider upgrading GPU for faster renders)"}
        </span>
      </div>

      {/* Bottlenecks */}
      {metrics.bottlenecks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-white/70">Bottlenecks Detected</p>
          <div className="space-y-1">
            {metrics.bottlenecks.map((bottleneck, idx) => (
              <button
                key={idx}
                onClick={() => setExpandedBottleneck(expandedBottleneck === bottleneck ? null : bottleneck)}
                className="w-full text-left rounded-lg bg-red-400/[0.06] p-2 transition hover:bg-red-400/[0.1]"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                  <span className="flex-1 text-xs font-medium text-red-200">{bottleneck}</span>
                  <span className="text-white/40">▼</span>
                </div>
                {expandedBottleneck === bottleneck && (
                  <p className="mt-1 pl-5 text-[10px] text-white/50">
                    {bottleneck.includes("Ken Burns")
                      ? "Disable Ken Burns zoom in preview mode to render 30% faster"
                      : bottleneck.includes("GPU")
                        ? "Install NVIDIA drivers or upgrade GPU for hardware acceleration"
                        : "Consider using preview quality mode for faster feedback"}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {metrics.recommendations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-white/70">Suggestions</p>
          <ul className="space-y-1 text-[10px] text-white/60">
            {metrics.recommendations.map((rec, idx) => (
              <li key={idx} className="flex gap-2 rounded bg-white/5 p-1.5">
                <span className="text-blue-400">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quality Selector */}
      {onQualityChange && (
        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-xs font-semibold text-white/70">Render Quality</p>
          <div className="grid grid-cols-3 gap-1">
            {(["preview", "standard", "premium"] as const).map((quality) => (
              <button
                key={quality}
                onClick={() => onQualityChange(quality)}
                className={`rounded px-2 py-1 text-xs font-semibold transition ${
                  quality === "standard"
                    ? "bg-blue-500 text-white"
                    : "border border-white/20 text-white/60 hover:border-white/40"
                }`}
              >
                {quality === "preview" && "🚀 Fast"}
                {quality === "standard" && "✨ Std"}
                {quality === "premium" && "👑 Max"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
