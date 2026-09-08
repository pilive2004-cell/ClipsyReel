"use client";

import { EmotionalStoryTimeline } from "@/types";

export default function StoryTimelinePreview({ timeline }: { timeline: EmotionalStoryTimeline }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 text-[11px] font-medium text-white/70">Story timeline</p>
      <div className="space-y-1.5">
        {timeline.emotionalCurve.map((beat) => (
          <div key={beat.role} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-2.5 py-1.5 text-[11px]">
            <span className="text-white/80">{beat.role}</span>
            <span className="text-white/50">{beat.startTime} → {beat.endTime}</span>
            <span className="font-semibold text-fuchsia-300">{beat.intensity}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
