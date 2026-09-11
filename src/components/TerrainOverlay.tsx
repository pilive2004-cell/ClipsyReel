"use client";

import { SportTelemetry } from "@/types";

function metricValue(label: string, value: string) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-slate-950/56 px-2.5 py-2 backdrop-blur-md shadow-[0_10px_24px_rgba(2,6,23,0.18)]">
      <p className="text-[8px] uppercase tracking-[0.24em] text-white/42">{label}</p>
      <p className="mt-1 text-[10px] font-semibold text-white/92">{value}</p>
    </div>
  );
}

interface TerrainOverlayProps {
  routeLabel?: string | null;
  sportTelemetry?: SportTelemetry | null;
  progress: number;
  compactTop?: boolean;
}

export default function TerrainOverlay({ routeLabel, sportTelemetry, progress, compactTop = false }: TerrainOverlayProps) {
  const routeName = routeLabel?.trim() || "Route";
  const distanceKm = sportTelemetry?.distanceKm ? `${sportTelemetry.distanceKm.toFixed(1)} km` : "—";
  const elevationM = sportTelemetry?.elevationGainM ? `${Math.round(sportTelemetry.elevationGainM)} m` : "—";
  const duration = sportTelemetry?.durationLabel || "—";
  const terrainProgress = Math.max(0, Math.min(1, progress || 0));

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 h-[36%] opacity-90" aria-hidden="true">
        <div
          className="absolute inset-x-0 bottom-0 h-full"
          style={{
            background: "linear-gradient(180deg, rgba(17,24,39,0.08), rgba(2,6,23,0.78))",
          }}
        />
        <svg viewBox="0 0 320 160" className="absolute inset-x-0 bottom-0 h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="terrainGlow" x1="0" x2="1">
              <stop offset="0%" stopColor="rgba(56,189,248,0.14)" />
              <stop offset="58%" stopColor="rgba(125,211,252,0.38)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.9)" />
            </linearGradient>
          </defs>
          <path d="M0,120 L42,82 L86,96 L104,62 L150,106 L188,68 L240,118 L278,88 L320,122 L320,160 L0,160 Z" fill="rgba(15,23,42,0.82)" />
          <path d="M0,132 L40,100 L90,114 L134,74 L170,122 L214,92 L256,136 L320,118 L320,160 L0,160 Z" fill="url(#terrainGlow)" opacity={0.82 + terrainProgress * 0.18} />
          <path d="M0,150 L34,146 L56,138 L78,146 L108,130 L138,148 L172,136 L214,150 L250,126 L284,146 L320,142 L320,160 L0,160 Z" fill="rgba(2,6,23,0.86)" />
        </svg>
      </div>

      <div className={`absolute left-3 right-3 ${compactTop ? "top-3" : "top-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-full border border-white/10 bg-slate-950/45 px-2 py-1 backdrop-blur-sm">
            <span className="text-[8px] uppercase tracking-[0.22em] text-white/62">{routeName}</span>
          </div>
          <div className="flex gap-2 text-[8px] uppercase tracking-[0.18em] text-white/60">
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-2 py-1">{distanceKm}</span>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-2 py-1">{elevationM}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/8 px-2 py-1 text-[8px] uppercase tracking-[0.2em] text-cyan-100/75">
            {duration}
          </span>
        </div>
      </div>
    </div>
  );
}
