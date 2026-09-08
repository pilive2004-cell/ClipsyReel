/**
 * TextOverlayPatternAnalyzer — MVP heuristic stub.
 *
 * Real text-overlay detection would require OCR / on-screen-text detection
 * on decoded frames (to find where hook text, captions, or callouts appear
 * in existing edits). That is out of scope for the MVP and, importantly,
 * this module must never read text from third-party videos it doesn't have
 * rights to — it only reports on the user's own analyzed reference video.
 * For now it returns a neutral placeholder result; wire in real OCR later.
 */
export interface TextOverlayPattern {
  hasHookText: boolean;
  estimatedTextDensity: "none" | "light" | "moderate" | "heavy";
  commonPlacement: "top" | "center" | "bottom" | "unknown";
}

export function analyzeTextOverlayPattern(): TextOverlayPattern {
  // Placeholder until real OCR-based detection is implemented.
  return {
    hasHookText: false,
    estimatedTextDensity: "none",
    commonPlacement: "unknown",
  };
}
