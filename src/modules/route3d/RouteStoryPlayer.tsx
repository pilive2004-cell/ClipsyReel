"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Route3DCinematicStage, { type Route3DStageHandle } from "./Route3DCinematicStage";
import type { RouteMetrics, VehicleKind, PlaybackSpeed, CameraMode } from "./types";
import { samplePointAtProgress, computeRouteMetrics } from "./routeMetrics";
import { useRouteExportRecorder } from "./useRouteExportRecorder";
import { routeService, type GeocodedPlace } from "./RouteService";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Base duration (at 1× speed) for one full playback sweep. */
const BASE_PLAYBACK_DURATION_SECONDS = 32;

const VEHICLE_KINDS: { kind: VehicleKind; label: string; icon: string }[] = [
  { kind: "motorcycle", label: "Moto", icon: "🏍️" },
  { kind: "car", label: "Voiture", icon: "🚗" },
  { kind: "bicycle", label: "Vélo", icon: "🚴" },
  { kind: "hiking", label: "Rando", icon: "🥾" },
];

const SPEED_OPTIONS: { value: PlaybackSpeed; label: string }[] = [
  { value: 0.5, label: "½×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" },
  { value: 8, label: "8×" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatAltitude(meters: number | null): string {
  return meters === null ? "—" : `${Math.round(meters)} m`;
}

// ─── Start/Destination panel ──────────────────────────────────────────────────

interface StartDestFormProps {
  onRouteReady: (metrics: RouteMetrics) => void;
}

function StartDestForm({ onRouteReady }: StartDestFormProps) {
  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [startResults, setStartResults] = useState<GeocodedPlace[]>([]);
  const [endResults, setEndResults] = useState<GeocodedPlace[]>([]);
  const [selectedStart, setSelectedStart] = useState<GeocodedPlace | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<GeocodedPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  async function searchPlace(query: string, setter: (r: GeocodedPlace[]) => void) {
    if (!query.trim()) return setter([]);
    try {
      const results = await routeService.geocode(query);
      setter(results.slice(0, 4));
    } catch {
      setter([]);
    }
  }

  async function buildRoute() {
    if (!selectedStart || !selectedEnd) return;
    setLoading(true);
    setError(null);
    setUsedFallback(false);
    try {
      const result = await routeService.getRoute(selectedStart, selectedEnd);
      setUsedFallback(result.usedFallback);
      const rawPoints = result.coordinates.map(([lng, lat]) => ({
        lat,
        lng,
        ele: null as number | null,
        time: null as Date | null,
      }));
      if (rawPoints.length < 2) { setError("Route trop courte."); return; }
      onRouteReady(computeRouteMetrics(rawPoints));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de calculer l'itinéraire.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-950/20 p-4">
      <p className="text-xs font-semibold text-sky-300 uppercase tracking-wide">Tracer un itinéraire</p>

      {/* Departure */}
      <div className="space-y-1">
        <label className="text-[11px] text-white/50">Départ</label>
        <div className="flex gap-2">
          <input type="text" placeholder="Ex: Las Vegas, NV" value={startQuery}
            onChange={(e) => setStartQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPlace(startQuery, setStartResults)}
            className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-sky-500"
          />
          <button type="button" onClick={() => searchPlace(startQuery, setStartResults)}
            className="rounded-lg bg-sky-600/40 px-3 py-2 text-xs text-sky-200 transition hover:bg-sky-600/60">🔍</button>
        </div>
        {startResults.length > 0 && !selectedStart && (
          <ul className="mt-1 rounded-lg border border-white/10 bg-neutral-900 text-xs divide-y divide-white/5">
            {startResults.map((r, i) => (
              <li key={i}><button type="button"
                className="w-full px-3 py-2 text-left text-white/70 hover:bg-white/5 transition"
                onClick={() => { setSelectedStart(r); setStartResults([]); setStartQuery(r.name.split(",")[0]); }}>
                {r.name.length > 60 ? r.name.slice(0, 60) + "…" : r.name}
              </button></li>
            ))}
          </ul>
        )}
        {selectedStart && (
          <p className="text-[11px] text-emerald-400">✓ {selectedStart.name.split(",")[0]}
            <button type="button" className="ml-2 text-white/30 hover:text-white/60"
              onClick={() => { setSelectedStart(null); setStartQuery(""); }}>✕</button></p>
        )}
      </div>

      {/* Arrival */}
      <div className="space-y-1">
        <label className="text-[11px] text-white/50">Arrivée</label>
        <div className="flex gap-2">
          <input type="text" placeholder="Ex: Salt Lake City, UT" value={endQuery}
            onChange={(e) => setEndQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPlace(endQuery, setEndResults)}
            className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-sky-500"
          />
          <button type="button" onClick={() => searchPlace(endQuery, setEndResults)}
            className="rounded-lg bg-sky-600/40 px-3 py-2 text-xs text-sky-200 transition hover:bg-sky-600/60">🔍</button>
        </div>
        {endResults.length > 0 && !selectedEnd && (
          <ul className="mt-1 rounded-lg border border-white/10 bg-neutral-900 text-xs divide-y divide-white/5">
            {endResults.map((r, i) => (
              <li key={i}><button type="button"
                className="w-full px-3 py-2 text-left text-white/70 hover:bg-white/5 transition"
                onClick={() => { setSelectedEnd(r); setEndResults([]); setEndQuery(r.name.split(",")[0]); }}>
                {r.name.length > 60 ? r.name.slice(0, 60) + "…" : r.name}
              </button></li>
            ))}
          </ul>
        )}
        {selectedEnd && (
          <p className="text-[11px] text-emerald-400">✓ {selectedEnd.name.split(",")[0]}
            <button type="button" className="ml-2 text-white/30 hover:text-white/60"
              onClick={() => { setSelectedEnd(null); setEndQuery(""); }}>✕</button></p>
        )}
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {usedFallback && !error && <p className="text-[11px] text-amber-400">⚠ OSRM indisponible — tracé en ligne droite.</p>}

      <button type="button" onClick={buildRoute} disabled={!selectedStart || !selectedEnd || loading}
        className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-2 text-xs font-semibold text-white transition disabled:opacity-40">
        {loading ? "Calcul de l'itinéraire…" : "Générer l'animation"}
      </button>
    </div>
  );
}

// ─── RouteStoryPlayer ─────────────────────────────────────────────────────────

export interface RouteStoryPlayerProps {
  /** GPX-derived metrics. If not provided, shows the start/destination form. */
  metrics?: RouteMetrics;
  onExportComplete?: (file: File, durationSeconds: number) => void;
  onClose?: () => void;
}

export default function RouteStoryPlayer({ metrics: propMetrics, onExportComplete, onClose }: RouteStoryPlayerProps) {
  const [metrics, setMetrics] = useState<RouteMetrics | null>(propMetrics ?? null);
  const stageRef = useRef<Route3DStageHandle>(null);

  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [vehicleKind, setVehicleKind] = useState<VehicleKind>("car");
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const [stageReady, setStageReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showStartDest, setShowStartDest] = useState(!propMetrics);

  // Refs for RAF loop
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const vehicleKindRef = useRef<VehicleKind>("car");
  const cameraModeRef = useRef<CameraMode>("follow");
  const speedRef = useRef<PlaybackSpeed>(1);
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUiSyncRef = useRef(0);

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { vehicleKindRef.current = vehicleKind; }, [vehicleKind]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const { isExporting, exportProgress, exportError, startExport } = useRouteExportRecorder();

  useEffect(() => {
    function tick(nowMs: number) {
      rafRef.current = requestAnimationFrame(tick);
      const stage = stageRef.current;
      if (!stage?.isReady()) { lastTickRef.current = nowMs; return; }

      const last = lastTickRef.current ?? nowMs;
      const dt = Math.max(0, Math.min(0.1, (nowMs - last) / 1000));
      lastTickRef.current = nowMs;

      if (playingRef.current) {
        const effectiveDuration = BASE_PLAYBACK_DURATION_SECONDS / speedRef.current;
        const next = progressRef.current + dt / effectiveDuration;
        progressRef.current = Math.min(1, next);
        if (nowMs - lastUiSyncRef.current > 66) {
          setProgress(progressRef.current);
          lastUiSyncRef.current = nowMs;
        }
        if (progressRef.current >= 1) { playingRef.current = false; setPlaying(false); }
      }

      stage.renderFrame({
        progress: progressRef.current,
        vehicleKind: vehicleKindRef.current,
        dt,
        cameraMode: cameraModeRef.current,
      });
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (progressRef.current >= 1) { progressRef.current = 0; setProgress(0); }
    setPlaying((p) => !p);
  }, []);

  const handleReset = useCallback(() => {
    playingRef.current = false; setPlaying(false);
    progressRef.current = 0; setProgress(0);
    lastTickRef.current = null;
  }, []);

  const handleScrub = useCallback((value: number) => {
    playingRef.current = false; setPlaying(false);
    progressRef.current = value; setProgress(value);
  }, []);

  const handleJumpToChapter = useCallback((chapterProgress: number) => {
    playingRef.current = false; setPlaying(false);
    progressRef.current = chapterProgress; setProgress(chapterProgress);
  }, []);

  const handleExport = useCallback(async () => {
    const result = await startExport({ stageRef, vehicleKind });
    if (result) onExportComplete?.(result.file, result.durationSeconds);
  }, [startExport, vehicleKind, onExportComplete]);

  const handleRouteReady = useCallback((newMetrics: RouteMetrics) => {
    setMetrics(newMetrics);
    setShowStartDest(false);
    setStageReady(false);
    progressRef.current = 0; setProgress(0);
  }, []);

  const current = useMemo(
    () => (metrics ? samplePointAtProgress(metrics.points, progress) : null),
    [metrics, progress]
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-950/90 p-4 text-white shadow-2xl backdrop-blur">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-white/90">Route Story</h3>
          {metrics && (
            <p className="text-xs text-white/50">
              {formatDistance(metrics.totalDistanceMeters)}
              {metrics.elevationGainM > 0 && <> · +{Math.round(metrics.elevationGainM)} m D+</>}
              {metrics.highestAltitudeM !== null && <> · sommet {formatAltitude(metrics.highestAltitudeM)}</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!propMetrics && (
            <button type="button" onClick={() => setShowStartDest((v) => !v)} title="Planifier un itinéraire"
              className={`rounded-full px-2.5 py-1 text-xs transition ${showStartDest ? "bg-sky-500/30 text-sky-300 ring-1 ring-sky-500" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
              📍 Itinéraire
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10">
              Fermer
            </button>
          )}
        </div>
      </div>

      {showStartDest && <StartDestForm onRouteReady={handleRouteReady} />}

      {/* Map */}
      {metrics ? (
        <Route3DCinematicStage ref={stageRef} metrics={metrics} vehicleKind={vehicleKind}
          onReady={() => setStageReady(true)} heightClassName="h-[340px] sm:h-[420px]" />
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-white/30">
          Importez un fichier GPX ou entrez un départ et une arrivée
        </div>
      )}

      {!stageReady && metrics && (
        <p className="text-center text-xs text-white/40">Chargement de la carte…</p>
      )}

      {metrics && (
        <>
          {/* Playback bar */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePlayPause} disabled={!stageReady}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/85 disabled:opacity-40"
              aria-label={playing ? "Pause" : "Lecture"}>
              {playing ? "⏸" : "▶"}
            </button>
            <button type="button" onClick={handleReset} disabled={!stageReady} title="Recommencer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/60 transition hover:bg-white/10 disabled:opacity-40">
              ↺
            </button>
            <input type="range" min={0} max={1} step={0.001} value={progress} disabled={!stageReady}
              onChange={(e) => handleScrub(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-red-500" />
            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-white/55">
              {formatDistance(current?.distanceFromStartM ?? 0)}
              {(current?.speedKmh ?? 0) > 0.5 && <> · {Math.round(current!.speedKmh)} km/h</>}
            </span>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {VEHICLE_KINDS.map((entry) => (
              <button key={entry.kind} type="button" onClick={() => setVehicleKind(entry.kind)} title={entry.label}
                className={`rounded-full px-2.5 py-1.5 text-sm transition ${vehicleKind === entry.kind ? "bg-amber-500/25 ring-1 ring-amber-400" : "bg-white/5 hover:bg-white/10"}`}>
                {entry.icon}
              </button>
            ))}
            <div className="h-5 w-px bg-white/10" />
            {SPEED_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setSpeed(opt.value)}
                className={`rounded-full px-2 py-1 text-xs transition ${speed === opt.value ? "bg-white/20 font-semibold text-white" : "text-white/50 hover:text-white/80"}`}>
                {opt.label}
              </button>
            ))}
            <div className="flex-1" />
            <button type="button" onClick={() => setShowControls((v) => !v)} title="Options caméra"
              className={`rounded-full px-2.5 py-1.5 text-xs transition ${showControls ? "bg-indigo-500/30 ring-1 ring-indigo-400" : "bg-white/5 hover:bg-white/10"}`}>
              🎬
            </button>
          </div>

          {/* Camera options */}
          {showControls && (
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/20 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wide">Mode caméra</p>
              <div className="flex gap-2 flex-wrap">
                {(["follow", "cinematic", "overview"] as CameraMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => setCameraMode(m)}
                    className={`rounded-lg px-3 py-1.5 text-xs transition ${cameraMode === m ? "bg-indigo-500/35 text-indigo-200 ring-1 ring-indigo-400" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
                    {m === "follow" && "📍 Suivi Nord"}
                    {m === "cinematic" && "🎥 Cinématique"}
                    {m === "overview" && "🗺 Vue d'ensemble"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/35">
                {cameraMode === "follow" && "Caméra centrée sur le véhicule, orientée Nord. Labels toujours lisibles."}
                {cameraMode === "cinematic" && "Caméra inclinée dans le sens du trajet. Effet cinématographique."}
                {cameraMode === "overview" && "Vue fixe sur l'ensemble du trajet."}
              </p>
            </div>
          )}

          {/* Chapters */}
          {metrics.chapters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {metrics.chapters.map((chapter) => (
                <button key={`${chapter.kind}-${chapter.pointIndex}`} type="button"
                  onClick={() => handleJumpToChapter(chapter.progress)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-xs transition hover:bg-white/10">
                  <div className="font-medium text-white/85">{chapter.title}</div>
                  <div className="text-white/45">{chapter.detail}</div>
                </button>
              ))}
            </div>
          )}

          {/* Export */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div className="text-xs text-white/45">
              {isExporting ? `Export… ${Math.round(exportProgress * 100)}%` : exportError ?? "Insérable dans votre montage Reel."}
            </div>
            <button type="button" onClick={handleExport} disabled={isExporting || !stageReady}
              className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40">
              {isExporting ? "Enregistrement…" : "Ajouter au montage"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
