"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Map } from "lucide-react";

interface AnimatedRoutePreviewProps {
  visible: boolean;
}

/**
 * A drawn-line loading animation shown over the real map while the GPX file
 * is being parsed and `leaflet-gpx` hasn't fired its `loaded` event yet.
 * Fades out once the real route/markers are ready.
 */
export default function AnimatedRoutePreview({ visible }: AnimatedRoutePreviewProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#0a0a10] via-[#0d0d16] to-[#0a0a10]"
        >
          <svg viewBox="0 0 200 100" className="h-20 w-40 opacity-80">
            <motion.polyline
              points="4,80 30,60 55,70 80,35 105,50 130,20 155,32 196,8"
              fill="none"
              stroke="url(#loadingRouteGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <defs>
              <linearGradient id="loadingRouteGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          <p className="flex items-center gap-1.5 text-xs font-medium text-white/50">
            <Map className="h-3.5 w-3.5 animate-pulse" /> Plotting your route…
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
