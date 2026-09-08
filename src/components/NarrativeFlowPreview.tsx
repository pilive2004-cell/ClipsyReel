"use client";

import { EmotionalStoryTimeline } from "@/types";
import EmotionalCurveChart from "./EmotionalCurveChart";
import StoryTimelinePreview from "./StoryTimelinePreview";
import PeakMomentCard from "./PeakMomentCard";
import OpeningHookCard from "./OpeningHookCard";
import EmotionalEndingCard from "./EmotionalEndingCard";
import ReelStoryScore from "./ReelStoryScore";

export default function NarrativeFlowPreview({ timeline }: { timeline: EmotionalStoryTimeline }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <OpeningHookCard beat={timeline.openingHook} />
        <PeakMomentCard beat={timeline.peakMoment} />
        <EmotionalEndingCard beat={timeline.emotionalEnding} />
        <ReelStoryScore score={timeline.reelScore} />
      </div>
      <EmotionalCurveChart timeline={timeline} />
      <StoryTimelinePreview timeline={timeline} />
    </div>
  );
}
