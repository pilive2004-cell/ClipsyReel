"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import PlanSelector from "./PlanSelector";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PricingModal({ open, onClose }: PricingModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b0b12] p-5 shadow-2xl sm:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Unlock ClipsyReel Pro</h2>
                <p className="text-xs text-white/45">Create more, faster, without the watermark.</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <PlanSelector onChoose={() => onClose()} />

            <p className="mt-4 text-center text-[10px] text-white/30">
              Cancel anytime. Prices shown in EUR. Payments are simulated in this MVP — Stripe Checkout integrates here later.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
