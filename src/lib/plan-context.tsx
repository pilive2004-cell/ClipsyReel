"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { PlanId } from "@/types";

/**
 * Demo-only plan context. In production this would be replaced by:
 * - A real auth/session provider
 * - The user's actual subscription status fetched from Stripe (via your
 *   backend, e.g. `GET /api/billing/subscription`) and kept in sync with
 *   Stripe webhooks (checkout.session.completed, customer.subscription.updated…)
 *
 * For the MVP we let the user toggle their "plan" directly in the UI so the
 * monetization/paywall logic can be demoed end-to-end without a backend.
 */
interface PlanContextValue {
  plan: PlanId;
  setPlan: (plan: PlanId) => void;
  isFree: boolean;
  isPro: boolean;
  reelsUsedThisWeek: number;
  consumeReelCredit: () => void;
  weeklyFreeLimit: number;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<PlanId>("free");
  const [reelsUsedThisWeek, setReelsUsedThisWeek] = useState(0);
  const weeklyFreeLimit = 1;

  const value = useMemo<PlanContextValue>(
    () => ({
      plan,
      setPlan,
      isFree: plan === "free",
      isPro: plan !== "free",
      reelsUsedThisWeek,
      consumeReelCredit: () => setReelsUsedThisWeek((n) => n + 1),
      weeklyFreeLimit,
    }),
    [plan, reelsUsedThisWeek]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
