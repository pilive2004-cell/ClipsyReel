"use client";

import { EmotionalStoryBeat } from "@/types";

export default function PeakMomentCard({ beat }: { beat: EmotionalStoryBeat }) {
  return (
    <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.08] p-3 text-xs">
      <p className="text-[10px] uppercase tracking-wider text-cyan-200/80">Peak Moment</p>
      <p className="mt-1 text-cyan-100">{beat.startTime} → {beat.endTime} · {beat.intensity}%</p>
      <p className="text-cyan-100/70">{beat.targetEmotion}</p>
    </div>
  );
}
