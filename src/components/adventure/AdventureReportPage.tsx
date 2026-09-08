"use client";

import { Hash, Image as ImageIcon, Mountain, Route, Sparkles, Trophy } from "lucide-react";
import AdventureCardPreview from "@/components/adventure/AdventureCardPreview";
import AdventureReportEquipmentSection from "@/components/adventure/AdventureReportEquipmentSection";
import AdventureRouteMapCard from "@/components/adventure/AdventureRouteMapCard";
import CommunityInsightsPreview from "@/components/adventure/CommunityInsightsPreview";
import { AdventureReportData } from "@/types";

interface AdventureReportPageProps {
  report: AdventureReportData;
}

export default function AdventureReportPage({ report }: AdventureReportPageProps) {
  return (
    <div className="space-y-4 rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Adventure Report</p>
          <h3 className="mt-1 text-lg font-semibold text-white/92">Turn your ride into a story</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/50">
            Reel preview, route context, ride stats and setup details — all in one mobile-first report.
          </p>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
          Story ready
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,260px),1fr]">
        <div className="space-y-4">
          <AdventureCardPreview report={report} />
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard icon={<Route className="h-4 w-4 text-fuchsia-300" />} label="Route" value={report.routeTitle} />
            <MetricCard icon={<Sparkles className="h-4 w-4 text-fuchsia-300" />} label="Ride score" value={report.rideScore ? `${report.rideScore}/100` : "Pending"} />
            <MetricCard icon={<Route className="h-4 w-4 text-fuchsia-300" />} label="Distance" value={report.distanceLabel ?? "No GPX"} />
            <MetricCard icon={<Mountain className="h-4 w-4 text-fuchsia-300" />} label="Elevation" value={report.elevationLabel ?? "No GPX"} />
            <MetricCard icon={<Mountain className="h-4 w-4 text-fuchsia-300" />} label="Highest point" value={report.highestPointLabel ?? "No GPX"} />
            <MetricCard icon={<Trophy className="h-4 w-4 text-fuchsia-300" />} label="Best moment" value={report.bestMomentLabel} />
            <MetricCard icon={<ImageIcon className="h-4 w-4 text-fuchsia-300" />} label="Thumbnail preview" value={report.thumbnailLabel} />
          </div>

          <AdventureRouteMapCard routeTitle={report.routeTitle} routePoints={report.routePoints} />

          {report.countriesOrRegion ? (
            <div className="rounded-[28px] border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Countries or region</p>
              <p className="mt-1 text-sm text-white/80">{report.countriesOrRegion}</p>
            </div>
          ) : null}

          <AdventureReportEquipmentSection setup={report.setup} />

          <div className="rounded-[28px] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Suggested caption</p>
            <p className="mt-2 text-sm leading-relaxed text-white/82">
              {report.suggestedCaption || "Write your own caption in the Hook & caption panel to complete this report."}
            </p>
            {report.suggestedHashtags.length > 0 ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/35">
                  <Hash className="h-3.5 w-3.5" />
                  Suggested hashtags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {report.suggestedHashtags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <CommunityInsightsPreview setup={report.setup} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-white/85">{value}</p>
    </div>
  );
}
