"use client";

import { BarChart3 } from "lucide-react";
import { buildCommunityInsightsPreview } from "@/lib/adventure-setup";
import { AdventureSetup } from "@/types";

interface CommunityInsightsPreviewProps {
  setup: AdventureSetup;
}

export default function CommunityInsightsPreview({ setup }: CommunityInsightsPreviewProps) {
  const insights = buildCommunityInsightsPreview(setup);

  return (
    <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-fuchsia-300" />
        <div>
          <p className="text-sm font-semibold text-white/90">Community insights preview</p>
          <p className="text-xs text-white/45">Future community exploration, already shaped around your ride setup.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.title} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{insight.title}</p>
            <ol className="mt-2 space-y-1.5">
              {insight.items.map((item, index) => (
                <li key={item + index} className="text-sm text-white/75">
                  <span className="mr-2 text-white/35">{index + 1}.</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
