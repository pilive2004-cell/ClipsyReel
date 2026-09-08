"use client";

import { EmotionalStoryBeat } from "@/types";

export default function EmotionalEndingCard({ beat }: { beat: EmotionalStoryBeat }) {
  return (
    <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] p-3 text-xs">
      <p className="text-[10px] uppercase tracking-wider text-emerald-200/80">Emotional Ending</p>
      <p className="mt-1 text-emerald-100">{beat.startTime} → {beat.endTime} · {beat.intensity}%</p>
      <p className="text-emerald-100/70">{beat.targetEmotion}</p>
    </div>
  );
}
