"use client";

import { motion } from "framer-motion";

interface AnimatedHookTextProps {
  text: string;
  className?: string;
  /** Delay (seconds) before the first letter starts revealing — lets it sync with other entrance animations (e.g. the phone-frame mount). */
  startDelay?: number;
  /** Seconds between each letter's reveal — smaller = snappier (Viral/Sport), larger = more deliberate (Cinematic/Luxury). */
  letterStagger?: number;
}

/** Splits `text` into user-perceived characters (graphemes) via `Intl.Segmenter` when the runtime supports it, so multi-byte characters/emoji in a custom hook never get split into broken half-glyphs; falls back to a plain code-point split otherwise. */
function splitGraphemes(text: string): string[] {
  const IntlWithSegmenter = Intl as typeof Intl & {
    Segmenter?: new (locale: string, opts: { granularity: "grapheme" }) => { segment(s: string): Iterable<{ segment: string }> };
  };
  if (IntlWithSegmenter.Segmenter) {
    const segmenter = new IntlWithSegmenter.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * Renders `text` with a letter-by-letter reveal animation (each character
 * fades/rises in with a tiny scale-pop, staggered left to right) instead of
 * the whole string fading in as one block — this is what's shown in the
 * in-app Reel preview's Hook overlay (`ReelPreview.tsx`) so the hook text
 * itself feels like a graphic, animated element rather than plain static
 * copy.
 *
 * Re-triggers whenever `text` changes (pass a `key={text}` on the consumer
 * side, as `ReelPreview` does) — e.g. switching from an AI-suggested hook to
 * a custom one replays the animation on the new text.
 */
export default function AnimatedHookText({ text, className, startDelay = 0, letterStagger = 0.028 }: AnimatedHookTextProps) {
  const graphemes = splitGraphemes(text);

  return (
    <motion.p aria-label={text} className={className}>
      {graphemes.map((char, i) => (
        <motion.span
          key={`${i}-${char}`}
          aria-hidden="true"
          className="inline-block"
          style={{ whiteSpace: char === " " ? "pre" : "normal" }}
          initial={{ opacity: 0, y: 10, scale: 0.7, rotate: -4 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{
            duration: 0.32,
            delay: startDelay + i * letterStagger,
            ease: [0.2, 0.8, 0.2, 1],
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.p>
  );
}
