import { CheckCircle2, Clock3, HelpCircle, MapPin } from "lucide-react";
import { VideoLocationConfidence, VideoLocationStatus } from "@/types";

interface MetadataConfidenceBadgeProps {
  status: VideoLocationStatus;
  confidence: VideoLocationConfidence;
  /** Compact mode omits the confidence label, shows only icon + status. */
  compact?: boolean;
}

const CONFIG: Record<
  VideoLocationStatus,
  { icon: typeof MapPin; label: string; confidence: string; bg: string; text: string; dot: string }
> = {
  gps_detected: {
    icon: MapPin,
    label: "GPS found",
    confidence: "High",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  timestamp_detected: {
    icon: Clock3,
    label: "Timestamp match",
    confidence: "Medium",
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
  metadata_missing: {
    icon: HelpCircle,
    label: "Metadata missing",
    confidence: "Low",
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    dot: "bg-orange-400",
  },
  manually_placed: {
    icon: CheckCircle2,
    label: "Manual placement",
    confidence: "Manual",
    bg: "bg-violet-500/15",
    text: "text-violet-300",
    dot: "bg-violet-400",
  },
};

export default function MetadataConfidenceBadge({ status, confidence, compact = false }: MetadataConfidenceBadgeProps) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
        <Icon className="h-2.5 w-2.5" />
        {cfg.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      <span className="opacity-60">· {confidence}</span>
    </span>
  );
}
