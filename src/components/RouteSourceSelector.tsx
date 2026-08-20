"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Bike,
  Car,
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
import type { GpxRouteStats, GpxTrackPoint, UploadedVideo } from "@/types";
import type { VehicleType, Waypoint } from "@/lib/route-service";
import RouteStatsCard from "./gpx/RouteStatsCard";
import VideoLocationMatcher from "./gpx/VideoLocationMatcher";

// ─── Types ────────────────────────────────────────────────────────────────────

type RouteMode = "gpx" | "locations";

export interface RouteSourceSelectorProps {
  videos: UploadedVideo[];
  onRouteDataChange?: (route: { points: GpxTrackPoint[] | null; stats: GpxRouteStats | null }) => void;
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
  resolved?: Waypoint | null;
  onChange: (v: string) => void;
  onRemove?: () => void;
  removable?: boolean;
}

function WaypointInput({ value, placeholder, status, resolved, onChange, onRemove, removable }: WaypointInputProps) {
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

  // ── Video matching ───────────────────────────────────────────────────────────
  const activePoints = mode === "gpx" ? gpxPoints : locationPoints;
  const activeStats  = mode === "gpx" ? gpxStats  : locationStats;

  const routeMatch = useMemo(() => {
    if (!activePoints || activePoints.length === 0 || videos.length === 0) return { matches: [], warning: null };
    return matchVideosToRoute(videos.map((v) => v.metadata), activePoints);
  }, [activePoints, videos]);

  // ── GPX handlers ─────────────────────────────────────────────────────────────

  const handleGpxFile = (file: File | undefined) => {
    if (!file) return;
    setGpxFileName(file.name);
    setGpxStats(null);
    setGpxPoints(null);
    onRouteDataChange?.({ points: null, stats: null });
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setGpxText(reader.result);
      const points = parseGpxPointsFromText(reader.result);
      const stats = points.length > 1 ? computeRouteStatsFromPoints(points) : null;
      setGpxPoints(points.length > 1 ? points : null);
      setGpxStats(stats);
      onRouteDataChange?.({ points: points.length > 1 ? points : null, stats });
    };
    reader.readAsText(file);
  };

  const clearGpx = () => {
    setGpxText(null);
    setGpxFileName("");
    setGpxStats(null);
    setGpxPoints(null);
    onRouteDataChange?.({ points: null, stats: null });
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

    try {
      const { generateRoute, exportRouteAsGpx, buildStraightLineRoute } = await import("@/lib/route-service");
      let result;
      try {
        result = await generateRoute(orderedWaypoints, vehicle);
      } catch (osrmErr) {
        console.warn("[RouteSourceSelector] OSRM failed, using straight-line fallback:", osrmErr);
        result = buildStraightLineRoute(orderedWaypoints, vehicle);
      }
      const gpxStr = exportRouteAsGpx(result);
      setLocationPoints(result.points);
      setLocationStats(result.stats);
      setLocationGpxStr(gpxStr);
      setRouteGenStatus("ready");
      onRouteDataChange?.({ points: result.points, stats: result.stats });
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
    onRouteDataChange?.({ points: null, stats: null });
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
        <div className="pointer-events-none flex h-36 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] blur-[1px] grayscale-[0.1] opacity-80">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-white/85">GPX import & route planner</p>
            <p className="mt-1 text-[11px] text-white/45">Upload a GPX file or plan a route from cities.</p>
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
      if (gpxPoints) onRouteDataChange?.({ points: gpxPoints, stats: gpxStats });
      else            onRouteDataChange?.({ points: null, stats: null });
    } else {
      clearGpx();
      if (locationPoints) onRouteDataChange?.({ points: locationPoints, stats: locationStats });
      else                 onRouteDataChange?.({ points: null, stats: null });
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
          depResolved={depResolved}
          destResolved={destResolved}
          stopResolved={stopResolved}
          routeGenStatus={routeGenStatus}
          routeError={routeError}
          locationPoints={locationPoints}
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
}

function GpxModePanel({
  gpxText, gpxFileName, gpxStats, gpxInputRef,
  routeMatch, onFileChange, onClear,
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
  depResolved: Waypoint | null;
  destResolved: Waypoint | null;
  stopResolved: Array<Waypoint | null>;
  routeGenStatus: "idle" | "loading" | "ready" | "error";
  routeError: string | null;
  locationPoints: GpxTrackPoint[] | null;
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
}

function LocationModePanel({
  departure, destination, stops, vehicle,
  depStatus, destStatus, stopStatuses,
  depResolved, destResolved,
  routeGenStatus, routeError,
  locationPoints, locationStats,
  canGenerate, routeMatch,
  onDepChange, onDestChange, onStopChange,
  onAddStop, onRemoveStop, onVehicleChange,
  onGenerate, onClearRoute, onDownloadGpx,
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
          resolved={depResolved}
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
          resolved={destResolved}
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
        </div>
      )}
    </div>
  );
}
