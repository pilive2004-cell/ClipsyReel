"use client";

import { useEffect, useState } from "react";
import { ImagePlus, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GEAR_CATALOG,
  GEAR_CATEGORY_KEYS,
  GearCategoryKey,
  GearSelections,
} from "@/data/gearCatalog";
import { useLocale } from "@/lib/i18n";

interface CreationExtrasPanelProps {
  selections: GearSelections;
  onSelectGearBrand: (key: GearCategoryKey, brand: string) => void;
  onSelectGearModel: (key: GearCategoryKey, model: string) => void;
  onChangeCustomGearModel: (key: GearCategoryKey, value: string) => void;
  portraitFile: File | null;
  onChangePortraitFile: (file: File | null) => void;
}

export default function CreationExtrasPanel({
  selections,
  onSelectGearBrand,
  onSelectGearModel,
  onChangeCustomGearModel,
  portraitFile,
  onChangePortraitFile,
}: CreationExtrasPanelProps) {
  const { copy } = useLocale();
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!portraitFile) {
      setPortraitPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(portraitFile);
    setPortraitPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [portraitFile]);

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div>
        <h2 className="text-sm font-semibold text-white/85">{copy.gear.title}</h2>
        <p className="mt-1 text-xs text-white/45">
          {copy.styleText.equipmentDescription}
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white/85">{copy.gear.photoTitle}</h3>
            <p className="mt-1 text-xs text-white/45">{copy.gear.photoDescription}</p>
          </div>
          {portraitFile && (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              {copy.gear.photoReady}
            </span>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-black/25">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onChangePortraitFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            {portraitPreviewUrl ? (
              <img src={portraitPreviewUrl} alt={copy.gear.photoTitle} className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-6 w-6 text-white/30" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/85">
              {portraitFile ? portraitFile.name : copy.gear.uploadPhoto}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              {portraitFile ? copy.gear.changePhoto : copy.gear.photoDescription}
            </p>
          </div>
        </label>

        {portraitFile && (
          <button
            type="button"
            onClick={() => onChangePortraitFile(null)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/65 hover:border-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            {copy.gear.removePhoto}
          </button>
        )}
      </div>

      <div className="space-y-5">
        {GEAR_CATEGORY_KEYS.map((key) => {
          const category = GEAR_CATALOG[key];
          const brands = Object.keys(category.brands);
          const selectedBrand = selections[key].brand;
          const models = selectedBrand ? category.brands[selectedBrand as keyof typeof category.brands] : [];
          return (
            <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div 
                className="mb-3 inline-block rounded-full px-4 py-1.5"
                style={{
                  background: 'linear-gradient(135deg, #FBBF24 0%, #FCD34D 40%, rgba(252, 211, 77, 0.4) 100%)'
                }}
              >
                <span className="text-sm font-bold text-black">{copy.gearLabel(key)}</span>
              </div>
              
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-white/40">{copy.gear.brand}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {brands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => onSelectGearBrand(key, brand)}
                    className={cn(
                      "rounded-lg border px-3.5 py-2 text-xs font-medium transition",
                      selectedBrand === brand ? "border-yellow-400/50 bg-yellow-400/15 text-yellow-100" : "border-white/15 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
                    )}
                  >
                    {brand}
                  </button>
                ))}
              </div>

              {selectedBrand && (
                <>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-white/40">{copy.gear.model}</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {models.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => onSelectGearModel(key, model)}
                        className={cn(
                          "rounded-lg border px-3.5 py-2 text-xs transition",
                          selections[key].model === model && !selections[key].customModel
                            ? "border-yellow-400/50 bg-yellow-400/15 text-yellow-100"
                            : "border-white/15 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                        )}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2.5 text-xs">
                <PenLine className="h-3.5 w-3.5 shrink-0 text-white/30" />
                <input
                  value={selections[key].customModel}
                  onChange={(e) => onChangeCustomGearModel(key, e.target.value)}
                  placeholder={selectedBrand ? copy.gear.chooseModel : copy.gear.chooseBrandFirst}
                  disabled={!selectedBrand}
                  className="flex-1 bg-transparent text-white/80 placeholder:text-white/30 focus:outline-none disabled:cursor-not-allowed disabled:text-white/25"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
