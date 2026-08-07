"use client";

import { PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GEAR_CATALOG,
  GEAR_CATEGORY_KEYS,
  GEAR_LABELS,
  GearCategoryKey,
  GearSelections,
} from "@/data/gearCatalog";

interface CreationExtrasPanelProps {
  selections: GearSelections;
  onSelectGearBrand: (key: GearCategoryKey, brand: string) => void;
  onSelectGearModel: (key: GearCategoryKey, model: string) => void;
  onChangeCustomGearModel: (key: GearCategoryKey, value: string) => void;
}

export default function CreationExtrasPanel({
  selections,
  onSelectGearBrand,
  onSelectGearModel,
  onChangeCustomGearModel,
}: CreationExtrasPanelProps) {
  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div>
        <h2 className="text-sm font-semibold text-white/85">Équipements</h2>
        <p className="mt-1 text-xs text-white/45">
          Pour chaque catégorie, choisis d&apos;abord la marque puis le modèle. Si ton modèle n&apos;est pas proposé, tu peux l&apos;écrire
          manuellement.
        </p>
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
                <span className="text-sm font-bold text-black">{GEAR_LABELS[key]}</span>
              </div>
              
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-white/40">Marque</p>
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
                  <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-white/40">Modèle proposé</p>
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
                  placeholder={selectedBrand ? `Choisir un modèle` : "Choisis d'abord une marque"}
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
