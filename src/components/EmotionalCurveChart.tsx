"use client";

import { EmotionalStoryTimeline } from "@/types";

export default function EmotionalCurveChart({ timeline }: { timeline: EmotionalStoryTimeline }) {
  const points = timeline.emotionalCurve.map((b, i) => `${(i / (timeline.emotionalCurve.length - 1 || 1)) * 100},${100 - b.intensity}`);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-[11px] font-medium text-white/70">Emotional curve</p>
      <svg viewBox="0 0 100 100" className="h-36 w-full">
        <polyline fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" points="0,50 100,50" />
        <polyline fill="none" stroke="url(#curveGradient)" strokeWidth="2.2" points={points.join(" ")} />
        <defs>
          <linearGradient id="curveGradient" x1="0" y1="0" x2="100" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="55%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
