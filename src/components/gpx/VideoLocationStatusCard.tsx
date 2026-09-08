import { Film } from "lucide-react";
import { VideoLocationMatch } from "@/types";
import MetadataConfidenceBadge from "./MetadataConfidenceBadge";

interface VideoLocationStatusCardProps {
  match: VideoLocationMatch;
}

const LEVEL_LABEL: Record<1 | 2 | 3, string> = {
  1: "Level 1 — GPS metadata",
  2: "Level 2 — Timestamp match",
  3: "Level 3 — No metadata",
};

const LEVEL_COLOR: Record<1 | 2 | 3, string> = {
  1: "text-emerald-400",
  2: "text-blue-400",
  3: "text-orange-400",
};

export default function VideoLocationStatusCard({ match }: VideoLocationStatusCardProps) {
  const gps = match.gpsCoordinates;
  const pt = match.matchedGPXPoint;
  const ts = match.creationTimestamp;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
          <Film className="h-3.5 w-3.5 text-white/50" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-white/90" title={match.fileName}>
            {match.fileName}
          </p>
          <p className={`text-[10px] font-medium mt-0.5 ${LEVEL_COLOR[match.detectionLevel]}`}>
            {LEVEL_LABEL[match.detectionLevel]}
          </p>
        </div>
        <MetadataConfidenceBadge status={match.status} confidence={match.confidence} compact />
      </div>

      {/* Details */}
      <div className="space-y-1 pl-9">
        {gps && (
          <p className="text-[10px] text-white/50">
            GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
          </p>
        )}
        {ts && (
          <p className="text-[10px] text-white/50">
            Captured: {ts.toLocaleString()}
          </p>
        )}
        {pt && (
          <p className="text-[10px] text-white/50">
            Matched point: {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}
            {pt.time ? ` at ${(pt.time as Date).toLocaleTimeString()}` : ""}
          </p>
        )}
        <p className="text-[10px] text-white/40 italic leading-relaxed">{match.message}</p>
      </div>
    </div>
  );
}
