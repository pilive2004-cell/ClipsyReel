"use client";

import { BadgeCheck, Gem, Shield } from "lucide-react";
import { PartnerStatus } from "@/types";
import { cn } from "@/lib/utils";

interface PartnerStatusBadgeProps {
  status: PartnerStatus;
  className?: string;
}

export default function PartnerStatusBadge({ status, className }: PartnerStatusBadgeProps) {
  if (status === "standard") return null;

  const config =
    status === "featured_partner"
      ? {
          icon: Gem,
          label: "Featured equipment",
          classes: "border-amber-400/25 bg-amber-400/10 text-amber-100",
        }
      : {
          icon: BadgeCheck,
          label: "Verified equipment",
          classes: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
        };

  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium", config.classes, className)}>
      {status === "verified_partner" ? <Shield className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
