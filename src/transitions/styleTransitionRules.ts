import { StylePreset, VisualStyleId } from "@/types/style.types";
import { STYLE_PRESETS } from "@/styles";

/**
 * Canonical, spec-named entry point for the per-style transition rule table.
 *
 * The actual style data lives in `src/styles/*.style.ts` (kept as-is, since
 * those files are also imported directly elsewhere); this re-exports the
 * same registry under the name the rule-system spec asks for.
 */
export type StyleTransitionRule = StylePreset;
export const STYLE_TRANSITION_RULES: Record<VisualStyleId, StyleTransitionRule> = STYLE_PRESETS;
