"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Crown, Palette, Sparkles } from "lucide-react";
import { usePlan } from "@/lib/plan-context";
import { LANGUAGE_OPTIONS, useLocale } from "@/lib/i18n";

interface AppShellProps {
  children: React.ReactNode;
  onOpenPricing: () => void;
}

export default function AppShell({ children, onOpenPricing }: AppShellProps) {
  const { plan, isPro } = usePlan();
  const { copy, locale, setLocale } = useLocale();
  const planLabel = copy.plan(plan).name;
  const [languageOpen, setLanguageOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palette, setPalette] = useState<"classic" | "earth" | "night" | "bold">("classic");
  const paletteLabel = palette === "earth" ? "Earth" : palette === "night" ? "Night" : palette === "bold" ? "Bold" : "Classic";

  useEffect(() => {
    const stored = window.localStorage.getItem("clipsyreel-palette");
    setPalette(stored === "earth" || stored === "night" || stored === "bold" ? stored : "classic");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    window.localStorage.setItem("clipsyreel-palette", palette);
  }, [palette]);

  return (
    <div className="relative isolate min-h-dvh flex flex-col overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 -z-20"
        style={{
          background:
            "linear-gradient(180deg,var(--app-shell-bg-top) 0%,var(--app-shell-bg-mid) 24%,var(--app-shell-bg-mid-2) 50%,var(--app-shell-bg-glow) 66%,var(--app-shell-bg-mid-3) 84%,var(--app-shell-bg-bottom) 100%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(140% 115% at 20% -16%,var(--app-shell-glow-a) 0%,color-mix(in srgb, var(--app-shell-glow-a) 58%, transparent) 34%,color-mix(in srgb, var(--app-shell-glow-a) 24%, transparent) 62%,transparent 100%),radial-gradient(130% 120% at 86% 64%,var(--app-shell-glow-b) 0%,color-mix(in srgb, var(--app-shell-glow-b) 58%, transparent) 36%,color-mix(in srgb, var(--app-shell-glow-b) 20%, transparent) 66%,transparent 100%)",
        }}
      />
      <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl" style={{ background: "var(--header-bg)" }}>
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 sm:max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient shadow-lg shadow-fuchsia-500/20">
              <Clapperboard className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              Clipsy<span className="brand-gradient-text">Reel</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setPaletteOpen((current) => !current)}
                className="palette-control flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition"
                aria-haspopup="listbox"
                aria-expanded={paletteOpen}
              >
                <Palette className="h-3.5 w-3.5" />
                {paletteLabel}
                <span className="text-white/50">▾</span>
              </button>
              {paletteOpen && (
                <div className="absolute right-0 z-30 mt-2 w-40 overflow-hidden rounded-2xl border border-white/10 p-1 shadow-2xl" style={{ background: "var(--menu-bg)" }}>
                  {[
                    { value: "classic" as const, label: "Classic" },
                    { value: "earth" as const, label: "Earth" },
                    { value: "night" as const, label: "Night" },
                    { value: "bold" as const, label: "Bold" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPalette(option.value);
                        setPaletteOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                        palette === option.value ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <span>{option.label}</span>
                      {palette === option.value && <span className="text-fuchsia-300">•</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setLanguageOpen((current) => !current)}
                className="palette-control flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition"
                aria-haspopup="listbox"
                aria-expanded={languageOpen}
              >
                {copy.languageLabel}
                <span className="text-white/50">▾</span>
              </button>
              {languageOpen && (
                <div className="absolute right-0 z-30 mt-2 w-36 overflow-hidden rounded-2xl border border-white/10 p-1 shadow-2xl" style={{ background: "var(--menu-bg)" }}>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setLocale(option.value);
                        setLanguageOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                        locale === option.value ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <span>{option.label}</span>
                      {locale === option.value && <span className="text-fuchsia-300">•</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onOpenPricing}
              className={
                isPro
                  ? "flex items-center gap-1.5 rounded-full pro-gradient px-3 py-1.5 text-xs font-semibold text-black shadow-md shadow-orange-500/20"
                  : "palette-control flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition"
              }
            >
              {isPro ? <Crown className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {planLabel}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4 sm:max-w-2xl">{children}</main>
    </div>
  );
}
