"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown, X } from "lucide-react";

interface UpgradePromptProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onUpgrade: () => void;
}

/** Contextual, non-aggressive paywall prompt shown right when a Free user hits a Pro-only action. */
export default function UpgradePrompt({ open, title, message, onClose, onUpgrade }: UpgradePromptProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0b12] p-5 text-center shadow-2xl"
          >
            <button
              onClick={onClose}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="mx-auto -mt-2 flex h-14 w-14 items-center justify-center rounded-2xl pro-gradient shadow-lg shadow-orange-500/20">
              <Crown className="h-6 w-6 text-black" />
            </div>

            <h3 className="mt-3 text-base font-bold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/55">{message}</p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={onUpgrade}
                className="w-full rounded-xl brand-gradient py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20"
              >
                See Pro plans
              </button>
              <button onClick={onClose} className="w-full py-2 text-xs font-medium text-white/40 hover:text-white/60">
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
