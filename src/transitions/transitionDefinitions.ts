import { TRANSITION_PRESETS, ALL_TRANSITION_IDS } from "@/transitions/transitionPresets";

/**
 * Canonical, spec-named entry point for the transition data table.
 *
 * The actual ~57 `TransitionDefinition` objects live in `transitionPresets.ts`
 * (kept as-is so nothing that already imports from it — e.g. `xfadeMapping.ts`
 * — needs to change); this file just re-exports them under the name the
 * rule-system spec asks for, so `transitionDefinitions.ts` is a real,
 * importable module rather than a duplicate copy of ~1000 lines of data.
 */
export const TRANSITION_DEFINITIONS = TRANSITION_PRESETS;
export { ALL_TRANSITION_IDS };
