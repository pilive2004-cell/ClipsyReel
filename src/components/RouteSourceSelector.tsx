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
import type { PlaceSuggestion, VehicleType, Waypoint } from "@/lib/route-service";
import VideoLocationMatcher from "./gpx/VideoLocationMatcher";

// ─── Types ────────────────────────────────────────────────────────────────────

type RouteMode = "gpx" | "locations";
type FieldStatus = "idle" | "loading" | "found" | "error";

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
  value: string;
  placeholder: string;
  status: FieldStatus;
  suggestions: PlaceSuggestion[];
  selectedMeta?: string | null;
  onChange: (v: string) => void;
  onSelect: (suggestion: PlaceSuggestion) => void;
  onRemove?: () => void;
  removable?: boolean;
}

function WaypointInput({
  value,
  placeholder,
  status,
  suggestions,
  selectedMeta,
  onChange,
  onSelect,
  onRemove,
  removable,
}: WaypointInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 pr-8 text-sm text-white/90 placeholder:text-white/35 outline-none focus:border-white/25 focus:bg-white/[0.08]"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
          {status === "found"   && <MapPin className="h-3.5 w-3.5 text-emerald-400" />}
          {status === "error"   && <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-xl border border-white/10 bg-[#0d1016] shadow-2xl shadow-black/35">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(suggestion);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-white/5 px-3 py-2 text-left text-xs text-white/85 transition last:border-b-0 hover:bg-white/[0.05]"
              >
                <span className="font-medium">{suggestion.name}</span>
                <span className="text-[10px] text-white/45">{suggestion.label}</span>
              </button>
            ))}
          </div>
        )}
        {status === "found" && selectedMeta && (
          <p className="mt-1 text-[10px] text-emerald-300/75">{selectedMeta}</p>
        )}
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

  const [depStatus,  setDepStatus]  = useState<FieldStatus>("idle");
  const [destStatus, setDestStatus] = useState<FieldStatus>("idle");
  const [stopStatuses, setStopStatuses] = useState<FieldStatus[]>([]);
  const [depSuggestions, setDepSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<PlaceSuggestion[]>([]);
  const [stopSuggestions, setStopSuggestions] = useState<PlaceSuggestion[][]>([]);

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

  // ── Video matching ───────────────────────────────────────────────────────────
  const activePoints = mode === "gpx" ? gpxPoints : locationPoints;
  const activeStats  = mode === "gpx" ? gpxStats  : locationStats;

  const routeMatch = useMemo(() => {
    if (!activePoints || activePoints.length === 0 || videos.length === 0) return { matches: [], warning: null };
    return matchVideosToRoute(videos.map((v) => v.metadata), activePoints);
  }, [activePoints, videos]);

  // ── Label helpers ─────────────────────────────────────────────────────────────

  const replaceRouteLabel = useCallback(async (i: number, waypoint: Waypoint) => {
    if (!activePoints) return;
    const { createRouteLabelForWaypoint, normalizeRouteLabels } = await import("@/lib/route-service");
    setRouteLabels((prev) => {
      if (!prev || !prev[i]) return prev;
      const next = [...prev];
      next[i] = createRouteLabelForWaypoint(activePoints, waypoint, { priority: prev[i].priority });
      const normalized = normalizeRouteLabels(next);
      onRouteDataChange?.({ points: activePoints, stats: activeStats, labels: normalized });
      return normalized;
    });
  }, [activePoints, activeStats, onRouteDataChange]);

  const removeRouteLabel = useCallback(async (i: number) => {
    const { normalizeRouteLabels } = await import("@/lib/route-service");
    setRouteLabels((prev) => {
      if (!prev) return prev;
      const normalized = normalizeRouteLabels(prev.filter((_, j) => j !== i));
      onRouteDataChange?.({ points: activePoints, stats: activeStats, labels: normalized });
      return normalized;
    });
  }, [activePoints, activeStats, onRouteDataChange]);

  const addLabelToRoute = useCallback(async (waypoint: Waypoint) => {
    if (!activePoints) return;
    const { createRouteLabelForWaypoint, normalizeRouteLabels } = await import("@/lib/route-service");
    setRouteLabels((prev) => {
      const normalized = normalizeRouteLabels([
        ...(prev ?? []),
        createRouteLabelForWaypoint(activePoints, waypoint, { priority: "major" }),
      ]);
      onRouteDataChange?.({ points: activePoints, stats: activeStats, labels: normalized });
      return normalized;
    });
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

  const resetLocationOutput = useCallback(() => {
    setLocationPoints(null);
    setLocationStats(null);
    setLocationGpxStr(null);
    setRouteGenStatus("idle");
    setRouteError(null);
    setRouteLabels(null);
    setLabelsStatus("idle");
    if (mode === "locations") {
      onRouteDataChange?.({ points: null, stats: null, labels: null });
    }
  }, [mode, onRouteDataChange]);

  const geocodeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const queueSuggestions = useCallback(
    (
      key: string,
      query: string,
      setStatus: (s: FieldStatus) => void,
      setSuggestions: (items: PlaceSuggestion[]) => void,
    ) => {
      clearTimeout(geocodeTimers.current[key]);
      if (!query.trim()) {
        setStatus("idle");
        setSuggestions([]);
        return;
      }
      setStatus("loading");
      geocodeTimers.current[key] = setTimeout(async () => {
        try {
          const { searchCitySuggestions } = await import("@/lib/route-service");
          const results = await searchCitySuggestions(query);
          setSuggestions(results);
          setStatus(results.length > 0 ? "idle" : "error");
        } catch {
          setSuggestions([]);
          setStatus("error");
        }
      }, 250);
    },
    [],
  );

  const handleDepChange = (v: string) => {
    setDeparture(v);
    setDepResolved(null);
    resetLocationOutput();
    queueSuggestions("dep", v, setDepStatus, setDepSuggestions);
  };

  const handleDestChange = (v: string) => {
    setDestination(v);
    setDestResolved(null);
    resetLocationOutput();
    queueSuggestions("dest", v, setDestStatus, setDestSuggestions);
  };

  const handleStopChange = (i: number, v: string) => {
    setStops((prev) => { const next = [...prev]; next[i] = v; return next; });
    setStopResolved((prev) => { const next = [...prev]; next[i] = null; return next; });
    resetLocationOutput();
    queueSuggestions(`stop-${i}`, v,
      (s) => setStopStatuses((p) => { const n = [...p]; n[i] = s; return n; }),
      (items) => setStopSuggestions((p) => { const n = [...p]; n[i] = items; return n; }),
    );
  };

  const selectDeparture = useCallback(async (suggestion: PlaceSuggestion) => {
    const { suggestionToWaypoint } = await import("@/lib/route-service");
    setDeparture(suggestion.label);
    setDepResolved(suggestionToWaypoint(suggestion));
    setDepStatus("found");
    setDepSuggestions([]);
    resetLocationOutput();
  }, [resetLocationOutput]);

  const selectDestination = useCallback(async (suggestion: PlaceSuggestion) => {
    const { suggestionToWaypoint } = await import("@/lib/route-service");
    setDestination(suggestion.label);
    setDestResolved(suggestionToWaypoint(suggestion));
    setDestStatus("found");
    setDestSuggestions([]);
    resetLocationOutput();
  }, [resetLocationOutput]);

  const selectStop = useCallback(async (i: number, suggestion: PlaceSuggestion) => {
    const { suggestionToWaypoint } = await import("@/lib/route-service");
    setStops((prev) => { const next = [...prev]; next[i] = suggestion.label; return next; });
    setStopResolved((prev) => { const next = [...prev]; next[i] = suggestionToWaypoint(suggestion); return next; });
    setStopStatuses((prev) => { const next = [...prev]; next[i] = "found"; return next; });
    setStopSuggestions((prev) => { const next = [...prev]; next[i] = []; return next; });
    resetLocationOutput();
  }, [resetLocationOutput]);

  const addStop = () => {
    setStops((p) => [...p, ""]);
    setStopStatuses((p) => [...p, "idle"]);
    setStopResolved((p) => [...p, null]);
    setStopSuggestions((p) => [...p, []]);
    resetLocationOutput();
  };

  const removeStop = (i: number) => {
    setStops((p) => p.filter((_, j) => j !== i));
    setStopStatuses((p) => p.filter((_, j) => j !== i));
    setStopResolved((p) => p.filter((_, j) => j !== i));
    setStopSuggestions((p) => p.filter((_, j) => j !== i));
    resetLocationOutput();
  };

  // ── Route generation ──────────────────────────────────────────────────────────

  const hasUnverifiedStops = stops.some((stop, i) => stop.trim() && !stopResolved[i]);
  const canGenerate =
    depStatus === "found" && !!depResolved &&
    destStatus === "found" && !!destResolved &&
    !hasUnverifiedStops;

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
    resetLocationOutput();
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
          gpxInputRef={gpxInputRef}
          routeMatch={routeMatch}
          onFileChange={handleGpxFile}
          onClear={clearGpx}
          videos={videos}
          labelsEditor={
            labelsStatus !== "idle" ? (
              <RouteLabelEditor
                key={routeLabels?.map((label) => `${label.name}:${label.lat}:${label.lng}:${label.progress}`).join("|") ?? "empty"}
                labels={routeLabels}
                status={labelsStatus}
                onReplace={replaceRouteLabel}
                onRemove={removeRouteLabel}
                onAdd={addLabelToRoute}
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
          depSuggestions={depSuggestions}
          destSuggestions={destSuggestions}
          stopStatuses={stopStatuses}
          stopSuggestions={stopSuggestions}
          routeGenStatus={routeGenStatus}
          routeError={routeError}
          canGenerate={!!canGenerate}
          routeMatch={routeMatch}
          videos={videos}
          depMeta={depResolved ? [depResolved.region, depResolved.country].filter(Boolean).join(" · ") : null}
          destMeta={destResolved ? [destResolved.region, destResolved.country].filter(Boolean).join(" · ") : null}
          stopMeta={stopResolved.map((stop) => (stop ? [stop.region, stop.country].filter(Boolean).join(" · ") : null))}
          onDepChange={handleDepChange}
          onDestChange={handleDestChange}
          onDepSelect={selectDeparture}
          onDestSelect={selectDestination}
          onStopChange={handleStopChange}
          onStopSelect={selectStop}
          onAddStop={addStop}
          onRemoveStop={removeStop}
          onVehicleChange={(next) => { setVehicle(next); resetLocationOutput(); }}
          onGenerate={generateRouteAction}
          onClearRoute={clearLocationRoute}
          onDownloadGpx={downloadGpx}
          labelsEditor={
            labelsStatus !== "idle" ? (
              <RouteLabelEditor
                key={routeLabels?.map((label) => `${label.name}:${label.lat}:${label.lng}:${label.progress}`).join("|") ?? "empty"}
                labels={routeLabels}
                status={labelsStatus}
                onReplace={replaceRouteLabel}
                onRemove={removeRouteLabel}
                onAdd={addLabelToRoute}
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
  gpxInputRef: React.RefObject<HTMLInputElement | null>;
  routeMatch: ReturnType<typeof matchVideosToRoute>;
  videos: UploadedVideo[];
  onFileChange: (f: File | undefined) => void;
  onClear: () => void;
  labelsEditor?: React.ReactNode;
}

function GpxModePanel({
  gpxText, gpxFileName, gpxInputRef,
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
          Verified place names are prepared for the cinematic map intro. Only the route, marker and labels are kept visually prominent.
        </p>
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
            Upload the .gpx file from your ride, hike or road trip — ClipsyReel verifies places and
            plots the route on a clean cinematic map with your video locations.
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
  depStatus: FieldStatus;
  destStatus: FieldStatus;
  depSuggestions: PlaceSuggestion[];
  destSuggestions: PlaceSuggestion[];
  depMeta: string | null;
  destMeta: string | null;
  stopStatuses: FieldStatus[];
  stopSuggestions: PlaceSuggestion[][];
  stopMeta: Array<string | null>;
  routeGenStatus: "idle" | "loading" | "ready" | "error";
  routeError: string | null;
  canGenerate: boolean;
  routeMatch: ReturnType<typeof matchVideosToRoute>;
  videos: UploadedVideo[];
  onDepChange: (v: string) => void;
  onDestChange: (v: string) => void;
  onDepSelect: (suggestion: PlaceSuggestion) => void;
  onDestSelect: (suggestion: PlaceSuggestion) => void;
  onStopChange: (i: number, v: string) => void;
  onStopSelect: (i: number, suggestion: PlaceSuggestion) => void;
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
  depStatus, destStatus, depSuggestions, destSuggestions, depMeta, destMeta, stopStatuses, stopSuggestions, stopMeta,
  routeGenStatus, routeError,
  canGenerate, routeMatch,
  onDepChange, onDestChange, onDepSelect, onDestSelect, onStopChange, onStopSelect,
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
          value={departure}
          placeholder="Departure city or address"
          status={depStatus}
          suggestions={depSuggestions}
          selectedMeta={depMeta}
          onChange={onDepChange}
          onSelect={onDepSelect}
        />

        {stops.map((stop, i) => (
          <WaypointInput
            key={i}
            value={stop}
            placeholder={`Stop ${i + 1}`}
            status={stopStatuses[i] ?? "idle"}
            suggestions={stopSuggestions[i] ?? []}
            selectedMeta={stopMeta[i] ?? null}
            onChange={(v) => onStopChange(i, v)}
            onSelect={(suggestion) => onStopSelect(i, suggestion)}
            onRemove={() => onRemoveStop(i)}
            removable
          />
        ))}

        <WaypointInput
          value={destination}
          placeholder="Destination city or address"
          status={destStatus}
          suggestions={destSuggestions}
          selectedMeta={destMeta}
          onChange={onDestChange}
          onSelect={onDestSelect}
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
      {routeGenStatus === "ready" && (
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
              The generated route is verified and ready for the map intro. Use the city list below to confirm each displayed place.
            </p>
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
  onReplace: (i: number, waypoint: Waypoint) => void;
  onRemove: (i: number) => void;
  onAdd: (waypoint: Waypoint) => void;
}

function formatStoredLabel(label: RouteLabel): string {
  const parts = [label.name];
  if (label.region && !parts.includes(label.region)) parts.push(label.region);
  if (label.country && !parts.includes(label.country)) parts.push(label.country);
  return parts.join(", ");
}

function RouteLabelEditor({
  labels, status, onReplace, onRemove, onAdd,
}: RouteLabelEditorProps) {
  const nextLabels = labels ?? [];
  const [drafts, setDrafts] = useState<string[]>(() => nextLabels.map(formatStoredLabel));
  const [fieldStatuses, setFieldStatuses] = useState<FieldStatus[]>(() => nextLabels.map(() => "found"));
  const [fieldSuggestions, setFieldSuggestions] = useState<PlaceSuggestion[][]>(() => nextLabels.map(() => []));
  const [addQuery, setAddQuery] = useState("");
  const [addStatus, setAddStatus] = useState<FieldStatus>("idle");
  const [addSuggestions, setAddSuggestions] = useState<PlaceSuggestion[]>([]);
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const queueSuggestions = useCallback((
    key: string,
    query: string,
    onStatus: (statusValue: FieldStatus) => void,
    onSuggestions: (suggestions: PlaceSuggestion[]) => void,
  ) => {
    clearTimeout(searchTimers.current[key]);
    if (!query.trim()) {
      onStatus("idle");
      onSuggestions([]);
      return;
    }
    onStatus("loading");
    searchTimers.current[key] = setTimeout(async () => {
      try {
        const { searchCitySuggestions } = await import("@/lib/route-service");
        const results = await searchCitySuggestions(query);
        onSuggestions(results);
        onStatus(results.length > 0 ? "idle" : "error");
      } catch {
        onSuggestions([]);
        onStatus("error");
      }
    }, 250);
  }, []);

  const handleDraftChange = (index: number, value: string) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    queueSuggestions(
      `label-${index}`,
      value,
      (statusValue) => setFieldStatuses((prev) => {
        const next = [...prev];
        next[index] = statusValue;
        return next;
      }),
      (suggestions) => setFieldSuggestions((prev) => {
        const next = [...prev];
        next[index] = suggestions;
        return next;
      }),
    );
  };

  const selectLabelSuggestion = async (index: number, suggestion: PlaceSuggestion) => {
    const { suggestionToWaypoint } = await import("@/lib/route-service");
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = suggestion.label;
      return next;
    });
    setFieldStatuses((prev) => {
      const next = [...prev];
      next[index] = "found";
      return next;
    });
    setFieldSuggestions((prev) => {
      const next = [...prev];
      next[index] = [];
      return next;
    });
    onReplace(index, suggestionToWaypoint(suggestion));
  };

  const handleAddQueryChange = (value: string) => {
    setAddQuery(value);
    queueSuggestions("label-add", value, setAddStatus, setAddSuggestions);
  };

  const handleAddSuggestion = async (suggestion: PlaceSuggestion) => {
    const { suggestionToWaypoint } = await import("@/lib/route-service");
    setAddQuery("");
    setAddSuggestions([]);
    setAddStatus("idle");
    onAdd(suggestionToWaypoint(suggestion));
  };

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
                <div className="flex-1">
                  <WaypointInput
                    value={drafts[i] ?? formatStoredLabel(label)}
                    placeholder="Search for a verified city…"
                    status={fieldStatuses[i] ?? "found"}
                    suggestions={fieldSuggestions[i] ?? []}
                    onChange={(value) => handleDraftChange(i, value)}
                    onSelect={(suggestion) => { void selectLabelSuggestion(i, suggestion); }}
                    selectedMeta={[label.region, label.country].filter(Boolean).join(" · ") || null}
                  />
                </div>
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
        <div className="space-y-2">
          <WaypointInput
            value={addQuery}
            placeholder="Add a verified city…"
            status={addStatus}
            suggestions={addSuggestions}
            onChange={handleAddQueryChange}
            onSelect={(suggestion) => { void handleAddSuggestion(suggestion); }}
          />
          <div className="flex items-center gap-1 text-[10px] text-white/40">
            <Plus className="h-3 w-3" />
            Select a suggestion to store verified coordinates.
          </div>
        </div>
      )}

      {addStatus === "error" && (
        <p className="text-[10px] text-rose-300/75">City not found. Try a different name.</p>
      )}
    </div>
  );
}
