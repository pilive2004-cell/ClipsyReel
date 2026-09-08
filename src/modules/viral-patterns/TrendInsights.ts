/**
 * TrendInsights — abstract, text-only editing knowledge sourced from public
 * research about short-form video performance (not from any downloaded/
 * scraped video). Used to keep the demo pattern library and the automatic
 * pattern selector aligned with currently-published, real editing trends.
 *
 * IMPORTANT (legal/ethical scope): every insight below is a *statistical
 * conclusion* published in a public article analyzing aggregate performance
 * data across many creators — never a copy of, or reference to, any specific
 * video, audio track, or visual content. Nothing here stores or reproduces
 * copyrighted material.
 *
 * How to refresh: periodically re-read a handful of reputable, publicly
 * published short-form video editing/marketing research articles (blogs,
 * platform-published research, agency case studies) and update the entries
 * below with a new `sourceNote` + `lastReviewed` date. This file is the
 * single place that "trend calibration" data lives, so a refresh never
 * requires touching the analyzer/mixer/scorer logic itself.
 */

export interface TrendInsight {
  id: string;
  /** Short human-readable finding, phrased as abstract editing guidance. */
  finding: string;
  /** Where this abstract conclusion was read (public article, not a video). */
  sourceNote: string;
  lastReviewed: string; // ISO date
}

export const TREND_INSIGHTS: TrendInsight[] = [
  {
    id: "minimal-hook-text",
    finding:
      "Top-performing hooks across niches use 0-5 words of on-screen text, letting a strong visual frame carry the opening rather than a caption.",
    sourceNote: "Public aggregate study of ~3,600 short-form videos across 6 content niches (hook-type performance analysis).",
    lastReviewed: "2026-08-03",
  },
  {
    id: "curiosity-gap-opening",
    finding: "Showing a compelling result before explaining how it was achieved keeps viewers watching to close the gap.",
    sourceNote: "Public aggregate study of ~3,600 short-form videos across 6 content niches (hook-type performance analysis).",
    lastReviewed: "2026-08-03",
  },
  {
    id: "pattern-interrupt-opening",
    finding: "Breaking the visual rhythm viewers expect from a feed (unusual motion, unexpected setting, strong contrast) improves scroll-stopping power.",
    sourceNote: "Public aggregate study of ~3,600 short-form videos across 6 content niches (hook-type performance analysis).",
    lastReviewed: "2026-08-03",
  },
  {
    id: "fast-cut-first-seconds",
    finding: "The opening seconds benefit from noticeably shorter shot durations than the rest of the edit, before settling into the main rhythm.",
    sourceNote: "General, widely-documented short-form editing convention (multiple independent editing guides converge on this).",
    lastReviewed: "2026-08-03",
  },
  {
    id: "single-clear-climax",
    finding: "Well-performing edits build energy toward one clear peak moment rather than spreading several equal peaks across the timeline.",
    sourceNote: "General, widely-documented short-form editing convention (multiple independent editing guides converge on this).",
    lastReviewed: "2026-08-03",
  },
  {
    id: "loopable-or-hero-ending",
    finding: "Endings that either loop cleanly back to the start or land on a strong, still \"hero\" frame outperform abrupt hard cuts.",
    sourceNote: "General, widely-documented short-form editing convention (multiple independent editing guides converge on this).",
    lastReviewed: "2026-08-03",
  },
];

/** Convenience lookup used by the automatic pattern selector to bias the
 * hook-text recommendation (fewer/no words) without depending on the full list shape. */
export function preferMinimalHookText(): boolean {
  return TREND_INSIGHTS.some((i) => i.id === "minimal-hook-text");
}
