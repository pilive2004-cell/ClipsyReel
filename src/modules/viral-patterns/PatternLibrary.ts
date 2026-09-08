/**
 * PatternLibrary — in-memory store of abstract MontagePattern entries.
 *
 * Ships with a manually authored demo set (see `data/demoPatterns.ts`) and
 * can also store patterns *derived* from user-supplied reference videos via
 * `ViralPatternAnalyzer` (never the raw video/audio itself — only the
 * abstract structure it extracts).
 */
import { EnergyLevel, MontagePattern, MontagePatternCategory, VideoType } from "./types";
import { DEMO_PATTERNS } from "./data/demoPatterns";

export interface PatternQuery {
  videoType?: VideoType;
  energy?: EnergyLevel;
  category?: MontagePatternCategory;
  /** Desired export duration in seconds — patterns whose `durationRange` doesn't overlap are excluded. */
  durationSeconds?: number;
}

export class PatternLibrary {
  private patterns: Map<string, MontagePattern> = new Map();

  constructor(seed: MontagePattern[] = DEMO_PATTERNS) {
    seed.forEach((p) => this.add(p));
  }

  add(pattern: MontagePattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  remove(id: string): void {
    this.patterns.delete(id);
  }

  get(id: string): MontagePattern | undefined {
    return this.patterns.get(id);
  }

  all(): MontagePattern[] {
    return Array.from(this.patterns.values());
  }

  count(): number {
    return this.patterns.size;
  }

  /**
   * Returns patterns matching the given query, ranked best-fit first.
   *
   * Only `category` is a hard filter (an explicit, intentional browse-by-category
   * request). `videoType` / `energy` are *preferences*, not hard requirements: no
   * style/footage combination should ever be able to empty out every candidate
   * (which used to silently fall back to an arbitrary, unrelated pattern — see
   * `bestMatch`). Instead they contribute a scoring bonus via `fitScore`, so a
   * style like "viral" (mapped to a `city` + `extreme` combo that no single demo
   * pattern matches on *both* axes) still lands on the genuinely closest pattern
   * by combined score rather than whatever happens to be first in the list.
   * `durationSeconds` keeps its wide (+/-15s) slack-based hard filter since a
   * wildly mismatched duration is a much weaker fit than videoType/energy misses.
   */
  query(query: PatternQuery): MontagePattern[] {
    const candidates = this.all().filter((p) => {
      if (query.category && p.category !== query.category) return false;
      if (query.durationSeconds != null) {
        const [lo, hi] = p.durationRange;
        // Allow a little slack outside the ideal range rather than hard-excluding —
        // a 30s pattern is still a reasonable fit for a 15s or 45s export.
        if (query.durationSeconds < lo - 15 || query.durationSeconds > hi + 15) return false;
      }
      return true;
    });

    return candidates.sort((a, b) => this.fitScore(b, query) - this.fitScore(a, query));
  }

  /** Best single match for a query, or `null` if the library is empty. */
  bestMatch(query: PatternQuery): MontagePattern | null {
    return this.query(query)[0] ?? this.all()[0] ?? null;
  }

  private fitScore(pattern: MontagePattern, query: PatternQuery): number {
    let score = pattern.premiumScore * 0.4 + pattern.uniquenessScore * 0.2;
    if (query.videoType && pattern.idealVideoType.includes(query.videoType)) score += 25;
    if (query.energy && pattern.energyProfile === query.energy) score += 20;
    if (query.durationSeconds != null) {
      const [lo, hi] = pattern.durationRange;
      const mid = (lo + hi) / 2;
      const distance = Math.abs(query.durationSeconds - mid);
      score += Math.max(0, 15 - distance / 3);
    }
    return score;
  }

  categories(): MontagePatternCategory[] {
    return Array.from(new Set(this.all().map((p) => p.category)));
  }
}

/** Shared default instance seeded with the demo patterns — convenient for
 * the test UI and for callers that don't need a custom/isolated library. */
export const defaultPatternLibrary = new PatternLibrary();
