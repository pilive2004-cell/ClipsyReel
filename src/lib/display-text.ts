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

export function isExplicitDisplayText(text: string | null | undefined): boolean {
  const trimmed = text?.trim() ?? "";
  if (trimmed.length < 1 || trimmed.length > 96) return false;
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return false;
  if (/^(?:[\p{P}\p{S}\s])+$/u.test(trimmed)) return false;
  return true;
}

export function filterCoherentDisplayTexts(texts: string[]): string[] {
  return texts.map((text) => text.trim()).filter((text) => text.length > 0 && isCoherentDisplayText(text));
}

export function resolveDisplayTitleText({
  preferredTitle,
  hookText,
  routeLabel,
  fallback = "ClipsyReel",
}: {
  preferredTitle?: string | null;
  hookText?: string | null;
  routeLabel?: string | null;
  fallback?: string;
}): string {
  const candidates = [preferredTitle, hookText, routeLabel, fallback];
  const selected = candidates
    .map((text) => text?.trim() ?? "")
    .find((text) => isCoherentDisplayText(text));

  return selected?.trim() || fallback.trim() || "ClipsyReel";
}

export function resolveNonSportOverlayTexts({
  hookText,
  reelTitle,
  customTextOverlays = [],
  overlayTexts = [],
}: {
  hookText?: string | null;
  reelTitle?: string | null;
  customTextOverlays?: string[];
  overlayTexts?: string[];
}): string[] {
  const normalizedTitle = reelTitle?.trim().toLocaleLowerCase() ?? "";
  const normalizedHook = hookText?.trim().toLocaleLowerCase() ?? "";
  const explicitOverlays = Array.from(
    new Set(
      filterCoherentDisplayTexts([
        ...overlayTexts,
        ...customTextOverlays,
      ]).filter((text) => {
        if (!normalizedTitle) return true;
        const normalizedText = text.trim().toLocaleLowerCase();
        return normalizedText !== normalizedTitle && normalizedText !== normalizedHook;
      })
    )
  );
  if (explicitOverlays.length > 0) {
    return explicitOverlays.slice(0, 3);
  }
  const fallbackHook = Array.from(
    new Set(
      filterCoherentDisplayTexts([hookText?.trim() ?? ""]).filter((text) => {
        if (!normalizedTitle) return true;
        const normalizedText = text.trim().toLocaleLowerCase();
        return normalizedText !== normalizedTitle;
      })
    )
  );
  return fallbackHook.length > 0 ? fallbackHook.slice(0, 3) : [];
}
