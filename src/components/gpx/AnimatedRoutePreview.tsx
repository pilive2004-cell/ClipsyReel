"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Map } from "lucide-react";
import { GpxTrackPoint } from "@/types";

interface AnimatedRoutePreviewProps {
  visible: boolean;
  points?: GpxTrackPoint[] | null;
}

type RouteSample = { x: number; y: number; z: number };

function normalizePoints(points: GpxTrackPoint[]): RouteSample[] {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const eles = points.map((p) => p.ele ?? 0);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minEle = Math.min(...eles);
  const maxEle = Math.max(...eles);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const eleSpan = Math.max(maxEle - minEle, 1e-6);

  return points.map((p) => ({
    x: (p.lng - minLng) / lngSpan,
    y: (p.lat - minLat) / latSpan,
    z: ((p.ele ?? 0) - minEle) / eleSpan,
  }));
}

function buildPath(samples: RouteSample[]) {
  if (samples.length === 0) {
    return "M 8 76 C 22 58, 34 66, 44 50 S 68 28, 92 18";
  }
  const pts = samples.map((p, i) => {
    const px = 8 + p.x * 84;
    const py = 78 - p.y * 38 - p.z * 8 + (i / Math.max(1, samples.length - 1)) * 6;
    return `${px.toFixed(1)} ${py.toFixed(1)}`;
  });
  return `M ${pts.join(" L ")}`;
}

function buildContourPaths(samples: RouteSample[], count = 5) {
  const base = samples.length > 0 ? samples : samplePositions([], 24);
  return Array.from({ length: count }, (_, layer) => {
    const offset = layer * 2.7;
    const squeeze = 1 - layer * 0.045;
    const points = base.map((p, i) => {
      const x = 8 + (p.x * 84 - 50) * squeeze + 50;
      const y = 78 - p.y * (36 - layer * 2.2) - p.z * (7 - layer * 0.35) + offset + Math.sin((i / Math.max(1, base.length - 1)) * Math.PI * 1.6) * layer * 0.55;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return `M ${points.join(" L ")}`;
  });
}

function buildRidgePath(samples: RouteSample[], amplitude: number, yBias: number, zBias: number) {
  const base = samples.length > 0 ? samples : samplePositions([], 24);
  const pts = base.map((p, i) => {
    const x = 8 + p.x * 84;
    const wave = Math.sin(i * 0.55) * amplitude + Math.cos(i * 0.23) * amplitude * 0.45;
    const y = 82 - p.y * 34 - p.z * zBias + yBias + wave;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M 0 100 L ${pts.join(" L ")} L 100 100 Z`;
}

function samplePositions(samples: RouteSample[], count = 24) {
  if (samples.length === 0) {
    return Array.from({ length: count }, (_, i) => {
      const t = i / Math.max(1, count - 1);
      return { x: 10 + t * 80, y: 72 - Math.sin(t * Math.PI) * 24, z: 0.25 + Math.sin(t * Math.PI * 2) * 0.08 };
    });
  }

  const segments: { from: RouteSample; to: RouteSample; length: number }[] = [];
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const from = samples[i - 1];
    const to = samples[i];
    const length = Math.hypot(to.x - from.x, to.y - from.y) + Math.abs(to.z - from.z) * 0.35;
    total += length;
    segments.push({ from, to, length });
  }
  if (total === 0) return Array.from({ length: count }, () => samples[0]);

  const result: RouteSample[] = [];
  for (let i = 0; i < count; i++) {
    const target = (i / Math.max(1, count - 1)) * total;
    let acc = 0;
    let seg = segments[0];
    for (const candidate of segments) {
      if (acc + candidate.length >= target) {
        seg = candidate;
        break;
      }
      acc += candidate.length;
      seg = candidate;
    }
    const localT = seg.length === 0 ? 0 : (target - acc) / seg.length;
    result.push({
      x: seg.from.x + (seg.to.x - seg.from.x) * localT,
      y: seg.from.y + (seg.to.y - seg.from.y) * localT,
      z: seg.from.z + (seg.to.z - seg.from.z) * localT,
    });
  }
  return result;
}

function getPointAtProgress(samples: RouteSample[], progress: number): RouteSample {
  if (samples.length === 0) return { x: 0.5, y: 0.5, z: 0.25 };
  if (samples.length === 1) return samples[0];
  const clamped = ((progress % 1) + 1) % 1;
  const scaled = clamped * (samples.length - 1);
  const i = Math.floor(scaled);
  const t = scaled - i;
  const a = samples[i];
  const b = samples[Math.min(i + 1, samples.length - 1)];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function useFlyoverProgress(speedSeconds = 9) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - start) / 1000;
      setProgress((elapsed / speedSeconds) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speedSeconds]);

  return progress;
}

function RouteFlyoverGraphic({ points }: { points?: GpxTrackPoint[] | null }) {
  const route = useMemo(() => normalizePoints(points ?? []), [points]);
  const path = useMemo(() => buildPath(route), [route]);
  const contours = useMemo(() => buildContourPaths(route, 6), [route]);
  const ridges = useMemo(
    () => [
      buildRidgePath(route, 2.8, 0, 7.5),
      buildRidgePath(route, 5.5, -2.5, 10),
      buildRidgePath(route, 8.2, -5, 12.5),
    ],
    [route]
  );
  const samples = useMemo(() => samplePositions(route, 40), [route]);
  const progress = useFlyoverProgress(route.length > 0 ? 8.4 : 7.2);
  const beacon = useMemo(() => getPointAtProgress(samples, progress), [samples, progress]);
  const nextBeacon = useMemo(() => getPointAtProgress(samples, progress + 0.02), [samples, progress]);
  const drift = Math.sin(progress * Math.PI * 2) * 0.9;
  const camX = 8 + beacon.x * 84 + drift * 5;
  const camY = 78 - beacon.y * 38 - beacon.z * 8 - Math.abs(drift) * 1.8;
  const camY2 = 78 - nextBeacon.y * 38 - nextBeacon.z * 8;
  const elevationSamples = samples.length > 0 ? samples : samplePositions([], 24);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#07070d] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_50%_82%,rgba(52,211,153,0.18),transparent_28%),linear-gradient(180deg,rgba(9,10,18,0.3),rgba(7,7,13,0.96))]"
        animate={{ opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -inset-x-10 top-6 h-24 rounded-full bg-cyan-300/10 blur-3xl"
        animate={{ x: ["-2%", "2%", "-2%"], opacity: [0.18, 0.26, 0.18] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-emerald-400/10 via-transparent to-transparent blur-2xl"
        animate={{ opacity: [0.4, 0.6, 0.4], y: [0, -2, 0] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_60%,rgba(255,255,255,0.07),transparent_18%),radial-gradient(circle_at_70%_55%,rgba(255,255,255,0.04),transparent_16%)]"
        animate={{ opacity: [0.55, 0.78, 0.55], scale: [1, 1.02, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(180deg,transparent,black_16%,black_86%,transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,transparent_38%,rgba(255,255,255,0.05)_50%,transparent_62%,transparent_100%)] opacity-60 [animation:flyover-shimmer_7s_linear_infinite]" />

      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#05050a] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#05050a] to-transparent" />
      <div className="absolute right-3 top-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur-md">
        Aerial valley
      </div>
      <div className="absolute left-3 bottom-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55 backdrop-blur-md">
        Rumbo-style flythrough
      </div>

      <motion.div
        className="absolute inset-0 origin-center will-change-transform"
        initial={{ scale: 1.05, rotateX: 66, rotateZ: -14, y: 14 }}
        animate={{ scale: 1.05, rotateX: 66, rotateZ: -14, y: [14, 0, 14] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d", perspective: 1200 }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="routeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="55%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="ridgeFar" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(148,163,184,0.18)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.08)" />
            </linearGradient>
            <linearGradient id="ridgeMid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(52,211,153,0.16)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.10)" />
            </linearGradient>
            <linearGradient id="ridgeNear" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(56,189,248,0.14)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.14)" />
            </linearGradient>
            <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Distant valley walls / horizon bands */}
          <motion.path
            d="M 0 41 C 12 30, 24 34, 34 28 S 56 22, 68 28 S 86 36, 100 22 L 100 0 L 0 0 Z"
            fill="url(#ridgeFar)"
            stroke="rgba(255,255,255,0.025)"
            strokeWidth="0.6"
            animate={{ y: [0, -1.2, 0], opacity: [0.48, 0.62, 0.48] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M 0 52 C 11 43, 24 46, 36 40 S 58 34, 70 41 S 89 48, 100 36 L 100 0 L 0 0 Z"
            fill="url(#ridgeMid)"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="0.7"
            animate={{ y: [0, 1.4, 0], opacity: [0.52, 0.72, 0.52] }}
            transition={{ duration: 9.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M 0 64 C 11 58, 20 58, 32 54 S 56 50, 67 55 S 85 61, 100 50 L 100 0 L 0 0 Z"
            fill="url(#ridgeNear)"
            stroke="rgba(255,255,255,0.045)"
            strokeWidth="0.8"
            animate={{ y: [0, -0.8, 0], opacity: [0.65, 0.82, 0.65] }}
            transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
          />

          {contours.map((contour, i) => (
            <motion.path
              key={contour}
              d={contour}
              fill="none"
              stroke={i % 2 === 0 ? "rgba(148,163,184,0.10)" : "rgba(52,211,153,0.08)"}
              strokeWidth={1.1 + i * 0.18}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={i % 3 === 0 ? "2 4" : "none"}
              initial={{ opacity: 0.1 }}
              animate={{ opacity: [0.08, 0.18, 0.08] }}
              transition={{ duration: 4 + i * 0.6, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}

          {/* Terraced mountain layers for depth */}
          <motion.path
            d={ridges[2]}
            fill="url(#ridgeFar)"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="0.8"
            animate={{ y: [0, -1.5, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d={ridges[1]}
            fill="url(#ridgeMid)"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
            animate={{ y: [0, 1.2, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d={ridges[0]}
            fill="url(#ridgeNear)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1.2"
            animate={{ y: [0, -0.8, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          />

          <path d={path} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4.5" strokeLinecap="round" />
          <motion.path
            d={path}
            fill="none"
            stroke="url(#routeGlow)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 5"
            filter="url(#softGlow)"
            initial={{ strokeDashoffset: 18, opacity: 0.8 }}
            animate={{ strokeDashoffset: 0, opacity: 1 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          />
        </svg>

        <motion.div
          className="absolute z-[6] h-40 w-40 rounded-full bg-cyan-300/5 blur-3xl"
          style={{ left: `${camX}%`, top: `${camY}%`, transform: "translate(-50%,-50%)" }}
          animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute z-10 h-4 w-4 rounded-full bg-cyan-100 shadow-[0_0_0_8px_rgba(34,211,238,0.12),0_0_26px_rgba(34,211,238,0.8)]"
          style={{ left: `${camX}%`, top: `${camY}%`, transform: "translate(-50%,-50%)" }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.88, 1, 0.88] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute z-[9] h-12 w-12 rounded-full border border-cyan-200/25 bg-cyan-300/5"
          style={{ left: `${camX}%`, top: `${camY}%`, transform: "translate(-50%,-50%)" }}
          animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.5, 0.18, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute z-[8] h-[1px] w-24 origin-left bg-gradient-to-r from-cyan-200/0 via-cyan-200/80 to-fuchsia-300/0"
          style={{
            left: `${camX}%`,
            top: `${camY}%`,
            transform: `translate(0,-50%) rotate(${(Math.atan2(camY2 - camY, nextBeacon.x - beacon.x) * 180) / Math.PI}deg)`,
          }}
          animate={{ opacity: [0.25, 0.75, 0.25], scaleX: [0.85, 1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute z-[7] h-[2px] w-32 origin-left rounded-full bg-gradient-to-r from-transparent via-white/45 to-transparent blur-[1px]"
          style={{
            left: `${camX}%`,
            top: `${camY}%`,
            transform: `translate(0,-50%) rotate(${(Math.atan2(camY2 - camY, nextBeacon.x - beacon.x) * 180) / Math.PI}deg)`,
          }}
          animate={{ opacity: [0.18, 0.38, 0.18], scaleX: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="absolute right-4 bottom-4 z-[7] w-[42%] min-w-[140px] max-w-[190px] rounded-[18px] border border-white/10 bg-black/45 p-2.5 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">Elevation profile</span>
            <span className="text-[9px] font-semibold text-cyan-200">Live</span>
          </div>
          <svg viewBox="0 0 100 34" className="h-12 w-full overflow-visible">
            <defs>
              <linearGradient id="elevLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="60%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 30 ${elevationSamples
                .map((s, i) => `L ${(i / Math.max(1, elevationSamples.length - 1)) * 100} ${30 - s.z * 20 - Math.sin(i * 0.45) * 2.5}`)
                .join(" ")}`}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <motion.path
              d={`M 0 30 ${elevationSamples
                .map((s, i) => `L ${(i / Math.max(1, elevationSamples.length - 1)) * 100} ${30 - s.z * 20 - Math.sin(i * 0.45) * 2.5}`)
                .join(" ")}`}
              fill="none"
              stroke="url(#elevLine)"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, 24] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
            />
          </svg>
        </div>

        <div className="absolute inset-x-6 bottom-6 h-24 rounded-[28px] bg-gradient-to-b from-white/[0.08] to-transparent blur-2xl" />
      </motion.div>

      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70 backdrop-blur-md">
            3D GPX flyover
          </div>
          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold text-cyan-200 backdrop-blur-md">
            Hover route
          </div>
        </div>

        <div className="max-w-[16rem] space-y-1 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-md">
          <p className="text-[11px] font-semibold text-white/90">Route altitude perspective</p>
          <p className="text-[10px] leading-relaxed text-white/45">
            Premium flyover preview with a moving camera line over the GPX path.
          </p>
        </div>
      </div>
    </div>
  );
}

const styleTag = `
@keyframes flyover-shimmer {
  0% { transform: translateX(-25%); }
  100% { transform: translateX(25%); }
}
`;

if (typeof document !== "undefined" && !document.getElementById("flyover-shimmer-style")) {
  const style = document.createElement("style");
  style.id = "flyover-shimmer-style";
  style.textContent = styleTag;
  document.head.appendChild(style);
}

export default function AnimatedRoutePreview({ visible, points }: AnimatedRoutePreviewProps) {
  const hasPoints = !!points && points.length > 0;

  return (
    <AnimatePresence mode="wait">
      {visible ? (
        <motion.div
          key="full"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0 z-[500] flex items-center justify-center bg-[#07070d] p-4"
        >
          <div className="relative h-[72%] w-full max-w-[560px]">
            <div className="absolute inset-0 -translate-y-5 rounded-[32px] bg-white/5 blur-2xl" />
            <div className="absolute inset-0 rounded-[32px] border border-white/10 bg-white/[0.02] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
              <RouteFlyoverGraphic points={points} />
            </div>
          </div>
        </motion.div>
      ) : hasPoints ? (
        <motion.div
          key="mini"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none absolute left-3 top-3 z-[500] w-[min(78vw,240px)]"
        >
          <div className="rounded-[22px] border border-white/10 bg-black/35 p-2.5 shadow-[0_18px_55px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">
                <Map className="h-3 w-3 text-cyan-300" />
                Flyover
              </span>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold text-cyan-200">3D</span>
            </div>
            <div className="h-28 overflow-hidden rounded-[16px]">
              <RouteFlyoverGraphic points={points} />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
