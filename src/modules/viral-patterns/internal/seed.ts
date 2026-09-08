/**
 * Small deterministic PRNG utilities shared by the MVP analysis stubs.
 *
 * These stubs analyze only local metadata (file name, size, duration) that
 * the user's own browser already has from a File they selected — never any
 * downloaded or remote content. They produce *plausible, varied* heuristic
 * results so the rest of the pipeline (PatternLibrary, RecipeGenerator,
 * Mixer, QualityScorer) can be exercised end-to-end today. Each stub is
 * commented with where real computer-vision / audio-analysis logic should
 * be plugged in later.
 */

/** Hashes a string into a positive 32-bit integer seed. */
export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 1;
}

/** Deterministic PRNG (mulberry32) — same seed always yields the same sequence,
 * so re-analyzing the same file produces stable (not random-flickering) results. */
export function makeSeededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reads basic playable duration from a local video File using the browser's
 * <video> element — the only "analysis" available without real frame decoding. */
export function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      // Non-browser environment (e.g. server-side tests) — fall back to a
      // size-based rough estimate rather than failing.
      resolve(Math.max(5, Math.min(90, file.size / (1024 * 1024))));
      return;
    }
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 15;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      resolve(15);
    };
    video.src = url;
  });
}
