"use client";

import { Clapperboard, Crown, Sparkles } from "lucide-react";
import { usePlan } from "@/lib/plan-context";
import { PLANS } from "@/data/mock";

interface AppShellProps {
  children: React.ReactNode;
  onOpenPricing: () => void;
}

export default function AppShell({ children, onOpenPricing }: AppShellProps) {
  const { plan, isPro } = usePlan();
  const planLabel = PLANS.find((p) => p.id === plan)?.name ?? "Free";

  return (
    <div className="relative isolate min-h-dvh flex flex-col overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(180deg,#07070f_0%,#0b0a14_24%,#171028_50%,#22133a_66%,#171128_84%,#07070f_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(140%_115%_at_20%_-16%,rgba(124,58,237,0.13)_0%,rgba(124,58,237,0.075)_34%,rgba(124,58,237,0.03)_62%,transparent_100%),radial-gradient(130%_120%_at_86%_64%,rgba(217,70,239,0.10)_0%,rgba(217,70,239,0.06)_36%,rgba(217,70,239,0.02)_66%,transparent_100%)]" />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 sm:max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient shadow-lg shadow-fuchsia-500/20">
              <Clapperboard className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              Clipsy<span className="brand-gradient-text">Reel</span>
            </span>
          </div>

          <button
            onClick={onOpenPricing}
            className={
              isPro
                ? "flex items-center gap-1.5 rounded-full pro-gradient px-3 py-1.5 text-xs font-semibold text-black shadow-md shadow-orange-500/20"
                : "flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/20 hover:bg-white/10"
            }
          >
            {isPro ? <Crown className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {planLabel}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4 sm:max-w-2xl">{children}</main>
    </div>
  );
}
