import type { EditingPatternMemoryStorage, Rule } from "../types";
import { recalculateTimeline, timelineSignature } from "../timeline-helpers";

export const DEFAULT_PATTERN_MEMORY_KEY = "editing-intelligence:recent-patterns";
export const DEFAULT_PATTERN_MEMORY_SIZE = 5;

function readHistory(storage: EditingPatternMemoryStorage, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(storage: EditingPatternMemoryStorage, key: string, values: string[]): void {
  try {
    storage.setItem(key, JSON.stringify(values));
  } catch {
    // Best-effort only — losing memory reduces variety but should never fail the edit.
  }
}

/**
 * Uses injected storage to remember recent structure signatures and rotates the
 * middle of the timeline when the exact same pattern would repeat.
 */
export function createAvoidRepetitivePatternsRule(
  storage: EditingPatternMemoryStorage,
  options: { storageKey?: string; maxHistory?: number } = {}
): Rule {
  const storageKey = options.storageKey ?? DEFAULT_PATTERN_MEMORY_KEY;
  const maxHistory = options.maxHistory ?? DEFAULT_PATTERN_MEMORY_SIZE;

  return {
    id: "avoid-repetitive-patterns",
    description: "Uses short-term memory to avoid repeating the same structure.",
    apply(context) {
      const initialSignature = timelineSignature(context.timeline);
      const recent = readHistory(storage, storageKey);
      let clips = [...context.timeline.clips];
      let changed = false;

      if (recent.includes(initialSignature) && clips.length > 3) {
        const middle = clips.slice(1, -1);
        const rotated = [...middle.slice(1), middle[0]];
        clips = [clips[0], ...rotated, clips[clips.length - 1]];
        changed = true;
      }

      const nextTimeline = changed ? recalculateTimeline({ ...context.timeline, clips }) : context.timeline;
      const nextSignature = timelineSignature(nextTimeline);
      writeHistory(storage, storageKey, [nextSignature, ...recent.filter((entry) => entry !== nextSignature)].slice(0, maxHistory));

      if (!changed) return context;
      return {
        ...context,
        timeline: nextTimeline,
        notes: [...context.notes, "Rule applied: varied structure to avoid repeating a recent pattern."],
      };
    },
  };
}
