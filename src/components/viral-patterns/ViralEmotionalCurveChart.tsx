"use client";

import { EmotionalCurve } from "@/modules/viral-patterns/types";

export default function ViralEmotionalCurveChart({ curve }: { curve: EmotionalCurve }) {
  const segments = curve.segments;
  const total = segments.length > 0 ? segments[segments.length - 1].end : 1;

  const points = segments.flatMap((s) => {
    const x1 = (s.start / total) * 100;
    const x2 = (s.end / total) * 100;
    return [`${x1},${100 - s.energy}`, `${x2},${100 - s.energy}`];
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-[11px] font-medium text-white/70">{curve.curveType}</p>
      <svg viewBox="0 0 100 100" className="h-36 w-full">
        <polyline fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" points="0,50 100,50" />
        <polyline fill="none" stroke="url(#viralCurveGradient)" strokeWidth="2.2" points={points.join(" ")} />
        <defs>
          <linearGradient id="viralCurveGradient" x1="0" y1="0" x2="100" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="55%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/50">
        {segments.map((s, i) => (
          <span key={i}>
            {s.phase}: {s.start}s–{s.end}s ({s.energy})
          </span>
        ))}
      </div>
    </div>
  );
}
