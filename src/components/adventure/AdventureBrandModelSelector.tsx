"use client";

import { useMemo, useState } from "react";
import { ChevronDown, LucideIcon, RotateCcw } from "lucide-react";
import PartnerStatusBadge from "@/components/adventure/PartnerStatusBadge";
import { createAdventureEquipmentItem, getAdventureEquipmentDisplayName, isAdventureEquipmentItemFilled } from "@/lib/adventure-setup";
import { cn } from "@/lib/utils";
import { AdventureCatalogOption, AdventureEquipmentCategory, AdventureEquipmentItem } from "@/types";

interface AdventureBrandModelSelectorProps {
  category: AdventureEquipmentCategory;
  title: string;
  question: string;
  icon: LucideIcon;
  options: AdventureCatalogOption[];
  value: AdventureEquipmentItem | null;
  onChange: (next: AdventureEquipmentItem | null) => void;
}

export default function AdventureBrandModelSelector({
  category,
  title,
  question,
  icon: Icon,
  options,
  value,
  onChange,
}: AdventureBrandModelSelectorProps) {
  const [open, setOpen] = useState(() => !isAdventureEquipmentItemFilled(value));
  const summary = getAdventureEquipmentDisplayName(value);
  const brandQuery = value?.brand ?? "";

  const filteredBrands = useMemo(() => {
    if (!brandQuery) return options.slice(0, 6);
    return options.filter((option) => option.brand.toLowerCase().includes(brandQuery.toLowerCase())).slice(0, 6);
  }, [brandQuery, options]);

  const selectedCatalog = useMemo(
    () => options.find((option) => option.brand.toLowerCase() === (value?.brand ?? "").trim().toLowerCase()) ?? null,
    [options, value?.brand]
  );

  const modelQuery = value?.model ?? "";
  const filteredModels = useMemo(() => {
    const models = selectedCatalog?.models ?? options.flatMap((option) => option.models);
    if (!modelQuery) return models.slice(0, 6);
    return models.filter((model) => model.toLowerCase().includes(modelQuery.toLowerCase())).slice(0, 6);
  }, [modelQuery, options, selectedCatalog]);

  const ensureItem = () => value ?? createAdventureEquipmentItem(category);

  const applyCatalogMeta = (item: AdventureEquipmentItem, catalog: AdventureCatalogOption | null) => ({
    ...item,
    logoUrl: catalog?.logoUrl ?? null,
    websiteUrl: catalog?.websiteUrl ?? null,
    affiliateUrl: catalog?.affiliateUrl ?? null,
    partnerStatus: catalog?.partnerStatus ?? "standard",
    usageCount: catalog?.usageCount ?? null,
    rating: catalog?.rating ?? null,
  });

  return (
    <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-4">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-fuchsia-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">{title}</p>
            <p className="mt-0.5 text-xs text-white/45">{summary || question}</p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/35 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs leading-relaxed text-white/55">{question}</p>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/35">Brand</label>
            <input
              value={value?.brand ?? ""}
              onChange={(e) => {
                const next = ensureItem();
                onChange(applyCatalogMeta({ ...next, brand: e.target.value }, null));
              }}
              placeholder="Search or type a brand"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white/90 placeholder:text-white/25 focus:border-fuchsia-400/40 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {filteredBrands.map((option) => (
                <button
                  key={option.brand}
                  type="button"
                  onClick={() => {
                    const next = ensureItem();
                    onChange(applyCatalogMeta({ ...next, brand: option.brand, model: value?.model ?? "" }, option));
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/[0.08]"
                >
                  {option.brand}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/35">Model</label>
            <input
              value={value?.model ?? ""}
              onChange={(e) => {
                const next = ensureItem();
                onChange(applyCatalogMeta({ ...next, model: e.target.value }, selectedCatalog));
              }}
              placeholder="Search or type a model"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white/90 placeholder:text-white/25 focus:border-fuchsia-400/40 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {filteredModels.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => {
                    const next = ensureItem();
                    onChange(applyCatalogMeta({ ...next, model }, selectedCatalog));
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/[0.08]"
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.18em] text-white/35">Custom detail</label>
            <input
              value={value?.customInput ?? ""}
              onChange={(e) => {
                const next = ensureItem();
                onChange({ ...next, customInput: e.target.value });
              }}
              placeholder="Setup note"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white/90 placeholder:text-white/25 focus:border-fuchsia-400/40 focus:outline-none"
            />
          </div>

          {value ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-end gap-2">
                <PartnerStatusBadge status={value.partnerStatus} />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-white/45 transition hover:text-white/75"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Skip for now
          </button>
        </div>
      ) : null}
    </div>
  );
}
