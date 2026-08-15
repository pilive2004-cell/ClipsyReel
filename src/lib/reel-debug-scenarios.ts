/**
 * Lightweight manual-debug scenarios for this repo (there is no dedicated test
 * runner configured yet). These cases define the expected outcome when
 * verifying the route-validation and reel-opening logic by hand in dev.
 */
export const REEL_DEBUG_SCENARIOS = [
  {
    name: "Italy GPX + Georgia videos",
    expected: "All videos flagged as geographic mismatches; no route markers placed.",
  },
  {
    name: "GPX + videos without GPS metadata",
    expected: "All videos marked as location unknown; no automatic route placement.",
  },
  {
    name: "Matching GPX and embedded video GPS",
    expected: "Videos snap to the nearest GPX point and appear as valid route markers.",
  },
  {
    name: "Failed map intro rendering",
    expected: "Export stops with a clear error instead of producing a reel without the intro map.",
  },
  {
    name: "Slow-motion overuse prevention",
    expected: "First footage shot is normal speed and no automatic slow-motion segments are added.",
  },
];
