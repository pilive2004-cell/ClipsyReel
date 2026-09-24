"use client";

import { Dice5, Sparkles } from "lucide-react";
import { RenderCreativityLevel, ViralStyleDNA } from "@/types";

interface ViralCreativityPanelProps {
  renderCreativityLevel: RenderCreativityLevel;
  viralStyleDNA: ViralStyleDNA;
  generateVersions: number;
  editingSeed: string;
  autoSeedPerRender: boolean;
  onChangeCreativityLevel: (value: RenderCreativityLevel) => void;
  onChangeViralStyleDNA: (value: ViralStyleDNA) => void;
  onChangeGenerateVersions: (value: number) => void;
  onChangeEditingSeed: (value: string) => void;
  onChangeAutoSeedPerRender: (value: boolean) => void;
  onRegenerateSeed: () => void;
}

const CREATIVITY_LEVELS: RenderCreativityLevel[] = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
const STYLE_DNA_OPTIONS: ViralStyleDNA[] = [
  "TIKTOK_FAST",
  "CAPCUT_TRENDING",
  "REDBULL_ACTION",
  "DJI_TRAVEL",
  "GO_PRO_ADVENTURE",
  "CINEMATIC_EPIC",
  "MOTORCYCLE_RALLY",
];

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function ViralCreativityPanel({
  renderCreativityLevel,
  viralStyleDNA,
  generateVersions,
  editingSeed,
  autoSeedPerRender,
  onChangeCreativityLevel,
  onChangeViralStyleDNA,
  onChangeGenerateVersions,
  onChangeEditingSeed,
  onChangeAutoSeedPerRender,
  onRegenerateSeed,
}: ViralCreativityPanelProps) {
  return (
    <div className="space-y-4 rounded-[28px] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100/85">
            <Sparkles className="h-3.5 w-3.5" />
            Creative Variability Engine
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white/92">Unique Viral renders, reproducible by seed</h3>
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-white/58">
            Auto Seed creates a fresh edit every render. Turn it off to lock the current seed and reproduce the same version exactly.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
          <span>Creativity level</span>
          <select
            value={renderCreativityLevel}
            onChange={(event) => onChangeCreativityLevel(event.target.value as RenderCreativityLevel)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm tracking-normal text-white/88 focus:border-fuchsia-400/35 focus:outline-none"
          >
            {CREATIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
          <span>Viral style DNA</span>
          <select
            value={viralStyleDNA}
            onChange={(event) => onChangeViralStyleDNA(event.target.value as ViralStyleDNA)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm tracking-normal text-white/88 focus:border-fuchsia-400/35 focus:outline-none"
          >
            {STYLE_DNA_OPTIONS.map((dna) => (
              <option key={dna} value={dna}>
                {formatLabel(dna)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
          <span>Versions to score</span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={generateVersions}
            onChange={(event) => onChangeGenerateVersions(Number(event.target.value))}
            className="w-full accent-fuchsia-400"
          />
          <div className="text-xs normal-case tracking-normal text-white/64">{generateVersions} candidate version{generateVersions > 1 ? "s" : ""}</div>
        </label>

        <label className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-white/78">
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/45">Auto seed</span>
          <button
            type="button"
            onClick={() => onChangeAutoSeedPerRender(!autoSeedPerRender)}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${
              autoSeedPerRender ? "border-fuchsia-400/35 bg-fuchsia-500/12 text-white" : "border-white/10 bg-black/25 text-white/72"
            }`}
          >
            <span>{autoSeedPerRender ? "New version every render" : "Reuse current seed"}</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{autoSeedPerRender ? "On" : "Off"}</span>
          </button>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="space-y-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
          <span>Editing seed</span>
          <input
            value={editingSeed}
            onChange={(event) => onChangeEditingSeed(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm normal-case tracking-normal text-white/88 placeholder:text-white/28 focus:border-fuchsia-400/35 focus:outline-none"
            placeholder="seed-12345"
          />
        </label>
        <button
          type="button"
          onClick={onRegenerateSeed}
          className="mt-[1.45rem] inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/82 transition hover:border-fuchsia-400/25 hover:bg-fuchsia-500/10"
        >
          <Dice5 className="h-4 w-4" />
          Shuffle seed
        </button>
      </div>
    </div>
  );
}
