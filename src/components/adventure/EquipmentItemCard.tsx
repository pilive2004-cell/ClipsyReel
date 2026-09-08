"use client";

import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentItemCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  detail?: string | null;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  muted?: boolean;
  className?: string;
}

export default function EquipmentItemCard({
  icon: Icon,
  title,
  value,
  detail,
  badge,
  action,
  muted,
  className,
}: EquipmentItemCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4",
        muted && "opacity-70",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-fuchsia-200">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{title}</p>
            <p className="mt-1 text-sm font-semibold text-white/90">{value}</p>
            {detail ? <p className="mt-1 text-xs leading-relaxed text-white/50">{detail}</p> : null}
            {badge ? <div className="mt-2">{badge}</div> : null}
          </div>
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/20" />
        )}
      </div>
    </div>
  );
}
