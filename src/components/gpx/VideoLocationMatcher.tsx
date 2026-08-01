import { HelpCircle, MapPin, Clock3 } from "lucide-react";
import { VideoRouteMatch } from "@/types";

interface VideoLocationMatcherProps {
  matches: VideoRouteMatch[];
}

const STATUS_META: Record<VideoRouteMatch["status"], { icon: typeof MapPin; label: string; className: string }> = {
  gps: { icon: MapPin, label: "Located via GPS metadata", className: "text-emerald-300" },
  timestamp: { icon: Clock3, label: "Matched via capture time", className: "text-amber-300" },
  unknown: { icon: HelpCircle, label: "Location unknown", className: "text-white/40" },
};

/**
 * Small summary list showing, for each uploaded video, how (or whether) it
 * was placed on the route: real GPS metadata, a timestamp-based match, or
 * "location unknown" when neither is available.
 */
export default function VideoLocationMatcher({ matches }: VideoLocationMatcherProps) {
  if (matches.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {matches.map((m) => {
        const meta = STATUS_META[m.status];
        const Icon = meta.icon;
        return (
          <div key={m.videoId} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.className}`} />
            <span className="truncate text-[11px] font-medium text-white/70">{m.name}</span>
            <span className={`ml-auto shrink-0 text-[10px] ${meta.className}`}>{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
