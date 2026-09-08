"use client";

import AdventureSetupCard from "@/components/adventure/AdventureSetupCard";
import { AdventureSetup } from "@/types";

interface AdventureReportEquipmentSectionProps {
  setup: AdventureSetup;
}

export default function AdventureReportEquipmentSection({ setup }: AdventureReportEquipmentSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Adventure setup</p>
        <h3 className="mt-1 text-base font-semibold text-white/90">This adventure was completed with</h3>
        <p className="mt-1 text-sm text-white/50">Authentic equipment context for the report, kept neutral and community-friendly.</p>
      </div>
      <AdventureSetupCard setup={setup} />
    </section>
  );
}
