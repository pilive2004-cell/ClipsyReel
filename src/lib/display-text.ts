export function isCoherentDisplayText(text: string | null | undefined): boolean {
  const trimmed = text?.trim() ?? "";
  if (trimmed.length < 3 || trimmed.length > 96) return false;
  if (!/\p{L}/u.test(trimmed)) return false;
  if (/^(?:[\p{P}\p{S}\s]|\d)+$/u.test(trimmed)) return false;
  if (/(.)\1{4,}/u.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    const unique = new Set(words.map((word) => word.toLowerCase()));
    if (unique.size <= Math.ceil(words.length / 2)) return false;
  }

  return true;
}

export function filterCoherentDisplayTexts(texts: string[]): string[] {
  return texts.map((text) => text.trim()).filter((text) => text.length > 0 && isCoherentDisplayText(text));
}
