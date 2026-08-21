"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  FileUp,
  Footprints,
  Loader2,
  Lock,
  Map,
  MapPin,
  Minus,
  Plus,
  Route,
  X,
  Download,
} from "lucide-react";

import { usePlan } from "@/lib/plan-context";
import { computeRouteStatsFromPoints, parseGpxPointsFromText } from "@/lib/gpx";
import { matchVideosToRoute } from "@/lib/video-location-matcher";
import type { GpxRouteStats, GpxTrackPoint, RouteLabel, UploadedVideo } from "@/types";
import type { VehicleType, Waypoint } from "@/lib/route-service";
import RouteStatsCard from "./gpx/RouteStatsCard";
import VideoLocationMatcher from "./gpx/VideoLocationMatcher";

// ─── Types ────────────────────────────────────────────────────────────────────

type RouteMode = "gpx" | "locations";

export interface RouteSourceSelectorProps {
  videos: UploadedVideo[];
  onRouteDataChange?: (route: {
    points: GpxTrackPoint[] | null;
    stats: GpxRouteStats | null;
    labels: RouteLabel[] | null;
  }) => void;
  onLockedClick: () => void;
}

// ─── Vehicle icons ────────────────────────────────────────────────────────────

const VEHICLES: Array<{ id: VehicleType; label: string; Icon: React.ElementType }> = [
  { id: "car",        label: "Car",        Icon: Car        },
  { id: "motorcycle", label: "Moto",       Icon: Car        }, // no moto icon in lucide
  { id: "bicycle",    label: "Bicycle",    Icon: Bike       },
  { id: "walking",    label: "Walking",    Icon: Footprints },
];

// ─── Waypoint input row ───────────────────────────────────────────────────────

interface WaypointInputProps {
  index: number;
  value: string;
  placeholder: string;
  status: "idle" | "loading" | "found" | "error";
  onChange: (v: string) => void;
  onRemove?: () => void;
  removable?: boolean;
}

function WaypointInput({ value, placeholder, status, onChange, onRemove, removable }: WaypointInputProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 pr-8 text-sm text-white/90 placeholder:text-white/35 outline-none focus:border-white/25 focus:bg-white/[0.08]"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
          {status === "found"   && <MapPin className="h-3.5 w-3.5 text-emerald-400" />}
          {status === "error"   && <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
        </div>
      </div>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Route source selector — replaces the standalone GPXUploader.
 *
 * Two modes:
 *   A) GPX import — drag & drop / browse a .gpx file (same behaviour as before)
 *   B) Location planner — enter departure + destination (+ optional stops),
 *      pick a vehicle, and generate a real road route via OSRM.
 *
 * Both modes emit `onRouteDataChange({ points, stats })` so the rest of the
 * pipeline (map intro, video matching, reel export) is unaffected.
 */
export default function RouteSourceSelector({ videos, onRouteDataChange, onLockedClick }: RouteSourceSelectorProps) {
  const { isFree } = usePlan();

  // ── Mode state ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<RouteMode>("gpx");

  // ── GPX mode state ───────────────────────────────────────────────────────────
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const [gpxText, setGpxText] = useState<string | null>(null);
  const [gpxFileName, setGpxFileName] = useState("");
  const [gpxStats, setGpxStats] = useState<GpxRouteStats | null>(null);
  const [gpxPoints, setGpxPoints] = useState<GpxTrackPoint[] | null>(null);

  // ── Location mode state ──────────────────────────────────────────────────────
  const [departure, setDeparture]     = useState("");
  const [destination, setDestination] = useState("");
  const [stops, setStops]             = useState<string[]>([]);
  const [vehicle, setVehicle]         = useState<VehicleType>("car");

  // Geocoding resolution status per field
  type FieldStatus = "idle" | "loading" | "found" | "error";
  const [depStatus,  setDepStatus]  = useState<FieldStatus>("idle");
  const [destStatus, setDestStatus] = useState<FieldStatus>("idle");
  const [stopStatuses, setStopStatuses] = useState<FieldStatus[]>([]);

  const [depResolved,  setDepResolved]  = useState<Waypoint | null>(null);
  const [destResolved, setDestResolved] = useState<Waypoint | null>(null);
  const [stopResolved, setStopResolved] = useState<Array<Waypoint | null>>([]);

  const [routeGenStatus, setRouteGenStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [routeError,     setRouteError]     = useState<string | null>(null);
  const [locationPoints, setLocationPoints] = useState<GpxTrackPoint[] | null>(null);
  const [locationStats,  setLocationStats]  = useState<GpxRouteStats | null>(null);
  const [locationGpxStr, setLocationGpxStr] = useState<string | null>(null);

  // ── Route labels state ───────────────────────────────────────────────────────
  const [routeLabels,   setRouteLabels]   = useState<RouteLabel[] | null>(null);
  const [labelsStatus,  setLabelsStatus]  = useState<"idle" | "detecting" | "ready">("idle");
  // Tracks the in-progress add-label geocode query
  const [addLabelQuery, setAddLabelQuery] = useState("");
  const [addLabelStatus, setAddLabelStatus] = useState<"idle" | "loading" | "error">("idle");

  // ── Video matching ───────────────────────────────────────────────────────────
  const activePoints = mode === "gpx" ? gpxPoints : locationPoints;
  const activeStats  = mode === "gpx" ? gpxStats  : locationStats;

  const routeMatch = useMemo(() => {
    if (!activePoints || activePoints.length === 0 || videos.length === 0) return { matches: [], warning: null };
    return matchVideosToRoute(videos.map((v) => v.metadata), activePoints);
  }, [activePoints, videos]);

  // ── Label helpers ─────────────────────────────────────────────────────────────

  const updateRouteLabel = useCallback((i: number, name: string) => {
    setRouteLabels((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[i] = { ...next[i], name };
      onRouteDataChange?.({ points: activePoints, stats: activeStats, labels: next });
      return next;
    });
  }, [activePoints, activeStats, onRouteDataChange]);

  const removeRouteLabel = useCallback((i: number) => {
    setRouteLabels((prev) => {
      if (!prev) return prev;
      const next = prev.filter((_, j) => j !== i);
      if (next.length > 0) { next[0].isStart = true; next[next.length - 1].isEnd = true; }
      for (let k = 1; k < next.length - 1; k++) {
        next[k].isStart = undefined;
        next[k].isEnd = undefined;
      }
      onRouteDataChange?.({ points: activePoints, stats: activeStats, labels: next });
      return next;
    });
  }, [activePoints, activeStats, onRouteDataChange]);

  const addLabelToRoute = useCallback(async (query: string) => {
    if (!activePoints) return;
    setAddLabelStatus("loading");
    try {
      const { geocodeCity, detectRouteLabels } = await import("@/lib/route-service");
      const wp = await geocodeCity(query);
      if (!wp) { setAddLabelStatus("error"); return; }
      const [newLabel] = await detectRouteLabels(activePoints, { knownWaypoints: [wp] });
      if (!newLabel) { setAddLabelStatus("error"); return; }
      setRouteLabels((prev) => {
        const next = [...(prev ?? []), newLabel].sort((a, b) => a.progress - b.progress);
        if (next.length > 0) { next[0].isStart = true; next[0].isEnd = undefined; }
        if (next.length > 1) { next[next.length - 1].isEnd = true; next[next.length - 1].isStart = undefined; }
        for (let i = 1; i < next.length - 1; i++) { next[i].isStart = undefined; next[i].isEnd = undefined; }
        onRouteDataChange?.({ points: activePoints, stats: activeStats, labels: next });
        return next;
      });
      setAddLabelQuery("");
      setAddLabelStatus("idle");
    } catch {
      setAddLabelStatus("error");
    }
  }, [activePoints, activeStats, onRouteDataChange]);

  // ── GPX handlers ─────────────────────────────────────────────────────────────

  const handleGpxFile = (file: File | undefined) => {
    if (!file) return;
    setGpxFileName(file.name);
    setGpxStats(null);
    setGpxPoints(null);
    setRouteLabels(null);
    setLabelsStatus("idle");
    onRouteDataChange?.({ points: null, stats: null, labels: null });
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") return;
      setGpxText(reader.result);
      const pts = parseGpxPointsFromText(reader.result);
      const stats = pts.length > 1 ? computeRouteStatsFromPoints(pts) : null;
      const activePoints = pts.length > 1 ? pts : null;
      setGpxPoints(activePoints);
      setGpxStats(stats);
      // Emit immediately (map intro starts, labels will arrive separately)
      onRouteDataChange?.({ points: activePoints, stats, labels: null });

      if (activePoints) {
        setLabelsStatus("detecting");
        try {
          const { detectRouteLabels } = await import("@/lib/route-service");
          const labels = await detectRouteLabels(activePoints);
          setRouteLabels(labels);
          setLabelsStatus("ready");
          onRouteDataChange?.({ points: activePoints, stats, labels });
        } catch {
          setLabelsStatus("ready");
          setRouteLabels([]);
        }
      }
    };
    reader.readAsText(file);
  };

  const clearGpx = () => {
    setGpxText(null);
    setGpxFileName("");
    setGpxStats(null);
    setGpxPoints(null);
    setRouteLabels(null);
    setLabelsStatus("idle");
    onRouteDataChange?.({ points: null, stats: null, labels: null });
    if (gpxInputRef.current) gpxInputRef.current.value = "";
  };

  // ── Geocoding ─────────────────────────────────────────────────────────────────

  // Debounced geocode helper (called from field onChange)
  const geocodeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const debouncedGeocode = useCallback(
    (key: string, query: string, setStatus: (s: FieldStatus) => void, setResolved: (w: Waypoint | null) => void) => {
      clearTimeout(geocodeTimers.current[key]);
      if (!query.trim()) { setStatus("idle"); setResolved(null); return; }
      setStatus("loading");
      geocodeTimers.current[key] = setTimeout(async () => {
        try {
          // Dynamic import to avoid loading the service during SSR
          const { geocodeCity } = await import("@/lib/route-service");
          const result = await geocodeCity(query);
          if (result) { setStatus("found"); setResolved(result); }
          else        { setStatus("error"); setResolved(null); }
        } catch {
          setStatus("error");
          setResolved(null);
        }
      }, 600);
    },
    [],
  );

  const handleDepChange = (v: string) => {
    setDeparture(v);
    setRouteGenStatus("idle");
    debouncedGeocode("dep", v, setDepStatus, setDepResolved);
  };

  const handleDestChange = (v: string) => {
    setDestination(v);
    setRouteGenStatus("idle");
    debouncedGeocode("dest", v, setDestStatus, setDestResolved);
  };

  const handleStopChange = (i: number, v: string) => {
    setStops((prev) => { const next = [...prev]; next[i] = v; return next; });
    setRouteGenStatus("idle");
    debouncedGeocode(
      `stop-${i}`, v,
      (s) => setStopStatuses((p) => { const n = [...p]; n[i] = s; return n; }),
      (w) => setStopResolved((p) => { const n = [...p]; n[i] = w; return n; }),
    );
  };

  const addStop = () => {
    setStops((p) => [...p, ""]);
    setStopStatuses((p) => [...p, "idle"]);
    setStopResolved((p) => [...p, null]);
  };

  const removeStop = (i: number) => {
    setStops((p) => p.filter((_, j) => j !== i));
    setStopStatuses((p) => p.filter((_, j) => j !== i));
    setStopResolved((p) => p.filter((_, j) => j !== i));
  };

  // ── Route generation ──────────────────────────────────────────────────────────

  const canGenerate =
    depStatus === "found" && depResolved &&
    destStatus === "found" && destResolved;

  const generateRouteAction = async () => {
    if (!depResolved || !destResolved) return;

    const orderedWaypoints: Waypoint[] = [
      depResolved,
      ...stops.map((_, i) => stopResolved[i]).filter((w): w is Waypoint => !!w),
      destResolved,
    ];

    setRouteGenStatus("loading");
    setRouteError(null);
    setRouteLabels(null);
    setLabelsStatus("idle");

    try {
      const { generateRoute, exportRouteAsGpx, detectRouteLabels } =
        await import("@/lib/route-service");
      const result = await generateRoute(orderedWaypoints, vehicle);
      const gpxStr = exportRouteAsGpx(result);
      setLocationPoints(result.points);
      setLocationStats(result.stats);
      setLocationGpxStr(gpxStr);
      setRouteGenStatus("ready");

      // For location planner: build labels instantly from the user's waypoints
      setLabelsStatus("detecting");
      const labels = await detectRouteLabels(result.points, { knownWaypoints: orderedWaypoints });
      setRouteLabels(labels);
      setLabelsStatus("ready");
      onRouteDataChange?.({ points: result.points, stats: result.stats, labels });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Route generation failed.";
      setRouteError(msg);
      setRouteGenStatus("error");
    }
  };

  const clearLocationRoute = () => {
    setLocationPoints(null);
    setLocationStats(null);
    setLocationGpxStr(null);
    setRouteGenStatus("idle");
    setRouteError(null);
    setRouteLabels(null);
    setLabelsStatus("idle");
    onRouteDataChange?.({ points: null, stats: null, labels: null });
  };

  // ── GPX download for generated routes ────────────────────────────────────────

  const downloadGpx = () => {
    if (!locationGpxStr) return;
    const blob = new Blob([locationGpxStr], { type: "application/gpx+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${departure}-${destination}.gpx`.replace(/[^a-z0-9._-]/gi, "-");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Locked state (free plan)
  // ─────────────────────────────────────────────────────────────────────────────

  if (isFree) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        className="group relative block w-full overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-left transition hover:border-white/20"
      >
        <div className="pointer-events-none flex h-40 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] blur-[1px] grayscale-[0.1] opacity-80">
          <div className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-white/85">GPX import & route planner</p>
            <p className="mt-1 text-[11px] text-white/45">Upload a GPX file or plan a route from cities.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-white/60">
                <FileUp className="h-3.5 w-3.5" />
                Import GPX
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-white/60">
                <Route className="h-3.5 w-3.5" />
                Plan route
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 px-4 text-center">
          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
            <Lock className="h-3 w-3" /> PRO FEATURE
          </span>
          <p className="text-xs font-medium text-white/85">GPX import & route planner</p>
          <p className="max-w-[240px] text-[11px] leading-relaxed text-white/50">
            Upload a GPX file or plan a route from cities with Creator Pro.
          </p>
        </div>
      </button>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mode tab bar
  // ─────────────────────────────────────────────────────────────────────────────

  const onModeChange = (next: RouteMode) => {
    if (next === mode) return;
    setMode(next);
    // Clear the other mode's data so the pipeline only has one active route
    if (next === "gpx") {
      clearLocationRoute();
      if (gpxPoints) onRouteDataChange?.({ points: gpxPoints, stats: gpxStats, labels: routeLabels });
      else            onRouteDataChange?.({ points: null, stats: null, labels: null });
    } else {
      clearGpx();
      if (locationPoints) onRouteDataChange?.({ points: locationPoints, stats: locationStats, labels: routeLabels });
      else                 onRouteDataChange?.({ points: null, stats: null, labels: null });
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl border border-white/8 bg-white/[0.03] p-1">
        <TabBtn active={mode === "gpx"} onClick={() => onModeChange("gpx")} icon={<FileUp className="h-3.5 w-3.5" />}>
          Import GPX
        </TabBtn>
        <TabBtn active={mode === "locations"} onClick={() => onModeChange("locations")} icon={<Route className="h-3.5 w-3.5" />}>
          Plan route
        </TabBtn>
      </div>

      {/* ── GPX mode ─────────────────────────────────────────────────────────── */}
      {mode === "gpx" && (
        <GpxModePanel
          gpxText={gpxText}
          gpxFileName={gpxFileName}
          gpxStats={gpxStats}
          gpxPoints={gpxPoints}
          gpxInputRef={gpxInputRef}
          routeMatch={routeMatch}
          onFileChange={handleGpxFile}
          onClear={clearGpx}
          videos={videos}
          labelsEditor={
            labelsStatus !== "idle" ? (
              <RouteLabelEditor
                labels={routeLabels}
                status={labelsStatus}
                addQuery={addLabelQuery}
                addStatus={addLabelStatus}
                onUpdate={updateRouteLabel}
                onRemove={removeRouteLabel}
                onAddQueryChange={setAddLabelQuery}
                onAddSubmit={() => { if (addLabelQuery.trim()) addLabelToRoute(addLabelQuery.trim()); }}
              />
            ) : null
          }
        />
      )}

      {/* ── Location planner mode ─────────────────────────────────────────── */}
      {mode === "locations" && (
        <LocationModePanel
          departure={departure}
          destination={destination}
          stops={stops}
          vehicle={vehicle}
          depStatus={depStatus}
          destStatus={destStatus}
          stopStatuses={stopStatuses}
          stopResolved={stopResolved}
          routeGenStatus={routeGenStatus}
          routeError={routeError}
          locationStats={locationStats}
          canGenerate={!!canGenerate}
          routeMatch={routeMatch}
          videos={videos}
          onDepChange={handleDepChange}
          onDestChange={handleDestChange}
          onStopChange={handleStopChange}
          onAddStop={addStop}
          onRemoveStop={removeStop}
          onVehicleChange={setVehicle}
          onGenerate={generateRouteAction}
          onClearRoute={clearLocationRoute}
          onDownloadGpx={downloadGpx}
          labelsEditor={
            labelsStatus !== "idle" ? (
              <RouteLabelEditor
                labels={routeLabels}
                status={labelsStatus}
                addQuery={addLabelQuery}
                addStatus={addLabelStatus}
                onUpdate={updateRouteLabel}
                onRemove={removeRouteLabel}
                onAddQueryChange={setAddLabelQuery}
                onAddSubmit={() => { if (addLabelQuery.trim()) addLabelToRoute(addLabelQuery.trim()); }}
              />
            ) : null
          }
        />
      )}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-white/10 text-white"
          : "text-white/45 hover:text-white/70"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── GPX mode panel ───────────────────────────────────────────────────────────

interface GpxModePanelProps {
  gpxText: string | null;
  gpxFileName: string;
  gpxStats: GpxRouteStats | null;
  gpxPoints: GpxTrackPoint[] | null;
  gpxInputRef: React.RefObject<HTMLInputElement | null>;
  routeMatch: ReturnType<typeof matchVideosToRoute>;
  videos: UploadedVideo[];
  onFileChange: (f: File | undefined) => void;
  onClear: () => void;
  labelsEditor?: React.ReactNode;
}

function GpxModePanel({
  gpxText, gpxFileName, gpxStats, gpxInputRef,
  routeMatch, onFileChange, onClear, labelsEditor,
}: GpxModePanelProps) {
  if (gpxText) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 truncate text-xs font-medium text-white/70">
            <Map className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="truncate">{gpxFileName}</span>
          </p>
          <button
            onClick={onClear}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
        <p className="text-sm font-medium text-white/85">Route imported</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          The cinematic map intro now uses the new route rendering pipeline. This panel only shows route stats and matches.
        </p>
        {gpxStats && <div className="mt-3"><RouteStatsCard stats={gpxStats} /></div>}
        </div>
        {routeMatch.warning && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{routeMatch.warning}</p>
        </div>
        )}
        {routeMatch.matches.length > 0 && (
          <div className="mt-3"><VideoLocationMatcher matches={routeMatch.matches} /></div>
        )}
        {labelsEditor && <div className="mt-3">{labelsEditor}</div>}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx"
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => gpxInputRef.current?.click()}
        className="flex w-full items-start gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
          <Map className="h-4.5 w-4.5 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/85">Import a GPX file</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
            Upload the .gpx file from your ride, hike or road trip — ClipsyReel plots it on a real
            interactive map with distance, elevation, duration and your video locations.
          </p>
        </div>
      </button>
    </div>
  );
}

// ─── Location planner panel ───────────────────────────────────────────────────

interface LocationModePanelProps {
  departure: string;
  destination: string;
  stops: string[];
  vehicle: VehicleType;
  depStatus: "idle" | "loading" | "found" | "error";
  destStatus: "idle" | "loading" | "found" | "error";
  stopStatuses: ("idle" | "loading" | "found" | "error")[];
  stopResolved: Array<Waypoint | null>;
  routeGenStatus: "idle" | "loading" | "ready" | "error";
  routeError: string | null;
  locationStats: GpxRouteStats | null;
  canGenerate: boolean;
  routeMatch: ReturnType<typeof matchVideosToRoute>;
  videos: UploadedVideo[];
  onDepChange: (v: string) => void;
  onDestChange: (v: string) => void;
  onStopChange: (i: number, v: string) => void;
  onAddStop: () => void;
  onRemoveStop: (i: number) => void;
  onVehicleChange: (v: VehicleType) => void;
  onGenerate: () => void;
  onClearRoute: () => void;
  onDownloadGpx: () => void;
  labelsEditor?: React.ReactNode;
}

function LocationModePanel({
  departure, destination, stops, vehicle,
  depStatus, destStatus, stopStatuses,
  routeGenStatus, routeError,
  locationStats,
  canGenerate, routeMatch,
  onDepChange, onDestChange, onStopChange,
  onAddStop, onRemoveStop, onVehicleChange,
  onGenerate, onClearRoute, onDownloadGpx, labelsEditor,
}: LocationModePanelProps) {

  return (
    <div className="space-y-3">
      {/* Vehicle selector */}
      <div className="flex gap-1.5">
        {VEHICLES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onVehicleChange(id)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-medium transition ${
              vehicle === id
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-white/8 bg-white/[0.03] text-white/45 hover:text-white/70"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Waypoint fields */}
      <div className="space-y-2">
        <WaypointInput
          index={0}
          value={departure}
          placeholder="Departure city or address"
          status={depStatus}
          onChange={onDepChange}
        />

        {stops.map((stop, i) => (
          <WaypointInput
            key={i}
            index={i + 1}
            value={stop}
            placeholder={`Stop ${i + 1}`}
            status={stopStatuses[i] ?? "idle"}
            onChange={(v) => onStopChange(i, v)}
            onRemove={() => onRemoveStop(i)}
            removable
          />
        ))}

        <WaypointInput
          index={stops.length + 1}
          value={destination}
          placeholder="Destination city or address"
          status={destStatus}
          onChange={onDestChange}
        />

        {stops.length < 3 && (
          <button
            type="button"
            onClick={onAddStop}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 py-2 text-[11px] text-white/40 transition hover:border-white/20 hover:text-white/60"
          >
            <Plus className="h-3.5 w-3.5" /> Add a stop
          </button>
        )}
      </div>

      {/* Generate button */}
      {routeGenStatus !== "ready" && (
        <button
          type="button"
          disabled={!canGenerate || routeGenStatus === "loading"}
          onClick={onGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-400/25 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {routeGenStatus === "loading" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Calculating route…</>
          ) : (
            <><Route className="h-4 w-4" /> Generate route</>
          )}
        </button>
      )}

      {routeError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-3 py-2 text-[11px] text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{routeError}</p>
        </div>
      )}

      {/* Route result */}
      {routeGenStatus === "ready" && locationStats && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5" /> Route ready
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onDownloadGpx}
                title="Download as GPX"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <Download className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onClearRoute}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
            <p className="text-sm font-medium text-white/85">Route ready</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              The generated route is ready for the map intro and can be downloaded as GPX.
            </p>
            <div className="mt-3">
              <RouteStatsCard stats={locationStats} />
            </div>
          </div>

          {routeMatch.warning && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[11px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{routeMatch.warning}</p>
            </div>
          )}
          {routeMatch.matches.length > 0 && <VideoLocationMatcher matches={routeMatch.matches} />}
          {labelsEditor}
        </div>
      )}
    </div>
  );
}

// ─── Route label editor ───────────────────────────────────────────────────────

interface RouteLabelEditorProps {
  labels: RouteLabel[] | null;
  status: "idle" | "detecting" | "ready";
  addQuery: string;
  addStatus: "idle" | "loading" | "error";
  onUpdate: (i: number, name: string) => void;
  onRemove: (i: number) => void;
  onAddQueryChange: (v: string) => void;
  onAddSubmit: () => void;
}

function RouteLabelEditor({
  labels, status, addQuery, addStatus,
  onUpdate, onRemove, onAddQueryChange, onAddSubmit,
}: RouteLabelEditorProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
          <MapPin className="h-3.5 w-3.5 text-emerald-400" />
          Cities along the route
        </p>
        {status === "detecting" && (
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> detecting…
          </span>
        )}
        {status === "ready" && labels && labels.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400/70">
            <CheckCircle2 className="h-2.5 w-2.5" /> {labels.length} detected
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {status === "detecting" && !labels && (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      )}

      {/* Label rows */}
      {labels && labels.length > 0 && (
        <div className="space-y-1.5">
          {labels.map((label, i) => {
            const isStart = i === 0;
            const isEnd = i === labels.length - 1;
            const dotCls = isStart
              ? "bg-emerald-400"
              : isEnd
              ? "bg-rose-400"
              : label.priority === "major"
              ? "bg-white/65"
              : "bg-white/30";
            return (
              <div key={i} className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
                <input
                  type="text"
                  value={label.name}
                  onChange={(e) => onUpdate(i, e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/85 placeholder:text-white/30 outline-none focus:border-white/20 focus:bg-white/[0.07] transition"
                />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  title="Remove"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/70 transition"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add city form */}
      {status === "ready" && (
        <form
          onSubmit={(e) => { e.preventDefault(); onAddSubmit(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={addQuery}
            onChange={(e) => onAddQueryChange(e.target.value)}
            placeholder="Add a city…"
            className="flex-1 min-w-0 rounded-lg border border-dashed border-white/10 bg-transparent px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/30 outline-none focus:border-white/20 transition"
          />
          <button
            type="submit"
            disabled={!addQuery.trim() || addStatus === "loading"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40 transition"
          >
            {addStatus === "loading" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </button>
        </form>
      )}

      {addStatus === "error" && (
        <p className="text-[10px] text-rose-300/75">City not found. Try a different name.</p>
      )}
    </div>
  );
}
