"use client";

import { useMemo, useState } from "react";
import { Download, MapPinned, Mountain, Sparkles, Star } from "lucide-react";
import {
  getAdventureEquipmentDisplayName,
  getAdventureNavigationDisplayName,
  isAdventureEquipmentItemFilled,
  isAdventureNavigationFilled,
} from "@/lib/adventure-setup";
import { generateAdventureCardPng } from "@/lib/creative-visuals";
import { saveBlobToDevice } from "@/lib/save-video";
import { AdventureReportData } from "@/types";

interface AdventureCardPreviewProps {
  report: AdventureReportData;
}

export default function AdventureCardPreview({ report }: AdventureCardPreviewProps) {
  const [isExporting, setIsExporting] = useState(false);
  const rows = [
    report.setup.motorcycle && isAdventureEquipmentItemFilled(report.setup.motorcycle)
      ? `🏍 ${getAdventureEquipmentDisplayName(report.setup.motorcycle)}`
      : null,
    report.setup.helmet && isAdventureEquipmentItemFilled(report.setup.helmet)
      ? `🪖 ${getAdventureEquipmentDisplayName(report.setup.helmet)}`
      : null,
    report.setup.camera && isAdventureEquipmentItemFilled(report.setup.camera)
      ? `📷 ${getAdventureEquipmentDisplayName(report.setup.camera)}`
      : null,
    report.setup.drone && isAdventureEquipmentItemFilled(report.setup.drone)
      ? `🚁 ${getAdventureEquipmentDisplayName(report.setup.drone)}`
      : null,
    report.setup.navigationApp && isAdventureNavigationFilled(report.setup.navigationApp)
      ? `🗺 ${getAdventureNavigationDisplayName(report.setup.navigationApp)}`
      : null,
    report.setup.tires && isAdventureEquipmentItemFilled(report.setup.tires)
      ? `🛞 ${getAdventureEquipmentDisplayName(report.setup.tires)}`
      : null,
  ].filter((item): item is string => !!item).slice(0, 5);

  const statLines = useMemo(
    () =>
      [report.distanceLabel, report.elevationLabel, report.setup.offroadExperience ? `Offroad Experience ${report.setup.offroadExperience.level}/10` : null]
        .filter((item): item is string => !!item)
        .slice(0, 3),
    [report.distanceLabel, report.elevationLabel, report.setup.offroadExperience]
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const png = await generateAdventureCardPng(1080, 1920, {
        routeTitle: report.routeTitle,
        region: report.countriesOrRegion,
        setupLines: rows,
        statLines,
      });
      const buffer = new ArrayBuffer(png.byteLength);
      new Uint8Array(buffer).set(png);
      const blob = new Blob([buffer], { type: "image/png" });
      const filename = `clipsyreel-adventure-card-${report.routeTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "story"}.png`;
      await saveBlobToDevice(blob, filename);
    } catch (error) {
      console.error("Adventure card export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Adventure Card</p>
          <p className="text-sm text-white/55">9:16 story-style preview</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/75 transition hover:bg-white/[0.08] disabled:opacity-60"
        >
          {isExporting ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {isExporting ? "Exporting..." : "Export PNG"}
        </button>
      </div>

      <div className="mx-auto aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.28),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 shadow-2xl shadow-black/40">
        <div className="flex h-full flex-col justify-between">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Adventure Card</p>
            {report.countriesOrRegion ? <p className="mt-2 text-sm text-white/60">{report.countriesOrRegion}</p> : null}
          </div>

          <div className="space-y-2 rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur">
            {rows.map((row) => (
              <p key={row} className="text-sm text-white/85">
                {row}
              </p>
            ))}

            <div className="grid grid-cols-2 gap-2 pt-2 text-sm text-white/75">
              {report.distanceLabel ? <Stat icon={<MapPinned className="h-3.5 w-3.5" />} label={report.distanceLabel} /> : null}
              {report.elevationLabel ? <Stat icon={<Mountain className="h-3.5 w-3.5" />} label={report.elevationLabel} /> : null}
              {report.setup.offroadExperience ? (
                <Stat icon={<Star className="h-3.5 w-3.5" />} label={`Offroad Experience ${report.setup.offroadExperience.level}/10`} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <span className="text-fuchsia-200">{icon}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}
