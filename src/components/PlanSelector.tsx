"use client";

import { Check, Crown, Sparkles } from "lucide-react";
import { PLANS } from "@/data/mock";
import { usePlan } from "@/lib/plan-context";
import { PlanId } from "@/types";
import { cn } from "@/lib/utils";

interface PlanSelectorProps {
  onChoose?: (planId: PlanId) => void;
}

/**
 * FUTURE BILLING INTEGRATION:
 * Clicking a paid plan should redirect to a Stripe Checkout session
 * (`POST /api/billing/checkout-session` → `stripe.checkout.sessions.create`)
 * instead of instantly flipping local demo state. On success, Stripe
 * webhooks would update the user's subscription status server-side, which
 * `usePlan()` would then read from your backend instead of local state.
 */
export default function PlanSelector({ onChoose }: PlanSelectorProps) {
  const { plan, setPlan } = usePlan();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {PLANS.map((p) => {
        const isCurrent = plan === p.id;
        return (
          <div
            key={p.id}
            className={cn(
              "relative flex flex-col rounded-2xl border p-4",
              p.highlight ? "border-fuchsia-400/40 bg-fuchsia-500/[0.06]" : "border-white/10 bg-white/[0.02]"
            )}
          >
            {p.badge && (
              <span
                className={cn(
                  "absolute -top-2.5 left-4 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  p.highlight ? "brand-gradient text-white" : "pro-gradient text-black"
                )}
              >
                {p.badge}
              </span>
            )}

            <div className="flex items-center gap-1.5">
              {p.id === "free" ? (
                <Sparkles className="h-3.5 w-3.5 text-white/50" />
              ) : (
                <Crown className="h-3.5 w-3.5 text-amber-400" />
              )}
              <h4 className="text-sm font-semibold text-white/90">{p.name}</h4>
            </div>
            <p className="mt-0.5 text-[11px] text-white/45">{p.tagline}</p>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-bold">{p.price === 0 ? "Free" : `€${p.price}`}</span>
              {p.price > 0 && <span className="text-xs text-white/40">/ month</span>}
            </div>

            <ul className="mt-4 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-white/70">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
              {p.lockedFeatures?.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-white/30 line-through decoration-white/20">
                  <span className="mt-0.5 h-3 w-3 shrink-0 text-center text-[10px]">×</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                setPlan(p.id);
                onChoose?.(p.id);
              }}
              className={cn(
                "mt-4 w-full rounded-xl py-2.5 text-xs font-semibold transition",
                isCurrent
                  ? "cursor-default border border-white/15 text-white/50"
                  : p.highlight
                    ? "brand-gradient text-white shadow-lg shadow-fuchsia-500/20 hover:opacity-90"
                    : p.id === "free"
                      ? "border border-white/15 text-white/80 hover:bg-white/5"
                      : "pro-gradient text-black hover:opacity-90"
              )}
            >
              {isCurrent ? "Current plan" : p.id === "free" ? "Switch to Free" : `Upgrade to ${p.name}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
