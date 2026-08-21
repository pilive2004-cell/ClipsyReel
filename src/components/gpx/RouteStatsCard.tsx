import { MountainSnow, TrendingUp } from "lucide-react";
import { GpxRouteStats } from "@/types";

interface RouteStatsCardProps {
  stats: GpxRouteStats;
}

/** Keeps only the terrain-relevant metrics to avoid cluttering the route UI with distance counters. */
export default function RouteStatsCard({ stats }: RouteStatsCardProps) {
  return (
    <div className="grid grid-cols-2 gap-2 text-center">
      <div className="rounded-lg bg-white/[0.03] py-2">
        <MountainSnow className="mx-auto h-3.5 w-3.5 text-white/40" />
        <p className="mt-1 text-xs font-semibold">{stats.elevationGainM} m</p>
      </div>
      <div className="rounded-lg bg-white/[0.03] py-2">
        <TrendingUp className="mx-auto h-3.5 w-3.5 text-white/40" />
        <p className="mt-1 text-xs font-semibold">{stats.highestPointM !== null ? `${stats.highestPointM} m` : "—"}</p>
      </div>
    </div>
  );
}
