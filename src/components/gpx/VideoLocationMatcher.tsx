import { AlertTriangle, HelpCircle, MapPin } from "lucide-react";
import { VideoRouteMatch } from "@/types";

interface VideoLocationMatcherProps {
  matches: VideoRouteMatch[];
}

const STATUS_META: Record<VideoRouteMatch["status"], { icon: typeof MapPin; label: string; className: string }> = {
  gps: { icon: MapPin, label: "Placed via embedded GPS", className: "text-emerald-300" },
  mismatch: { icon: AlertTriangle, label: "Outside GPX route area", className: "text-amber-300" },
  unknown: { icon: HelpCircle, label: "Location unknown", className: "text-white/40" },
};

/**
 * Small summary list showing, for each uploaded video, how (or whether) it
 * was (or was not) placed on the route:
 * - real embedded GPS close to the route → marker shown
 * - embedded GPS far away from the route → rejected as a geographic mismatch
 * - no usable GPS → "location unknown"
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
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-white/70">{m.name}</p>
              <p className="truncate text-[10px] text-white/35">{m.reason}</p>
            </div>
            <span className={`shrink-0 text-[10px] ${meta.className}`}>{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
