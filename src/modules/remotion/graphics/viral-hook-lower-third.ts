function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(input: number, inputStart: number, inputEnd: number, outputStart: number, outputEnd: number) {
  if (inputEnd === inputStart) return outputEnd;
  const progress = clamp01((input - inputStart) / (inputEnd - inputStart));
  return outputStart + (outputEnd - outputStart) * progress;
}

function getReveal(frame: number, inStart: number, inEnd: number, outStart: number, outEnd: number) {
  if (frame <= inStart) return 0;
  if (frame < inEnd) return lerp(frame, inStart, inEnd, 0, 1);
  if (frame <= outStart) return 1;
  if (frame < outEnd) return lerp(frame, outStart, outEnd, 1, 0);
  return 0;
}

type TextMeasurer = Pick<CanvasRenderingContext2D, "font" | "measureText">;

function fitFontSizeToWidth(
  ctx: TextMeasurer,
  text: string,
  maxTextWidth: number,
  minFontSize: number,
  maxFontSize: number,
  fontFamily: string
) {
  let low = minFontSize;
  let high = maxFontSize;
  let best = minFontSize;

  for (let attempt = 0; attempt < 9; attempt++) {
    const mid = (low + high) / 2;
    ctx.font = `800 ${mid}px ${fontFamily}`;
    const width = ctx.measureText(text).width;
    if (width <= maxTextWidth) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  ctx.font = `800 ${best}px ${fontFamily}`;
  return best;
}

export function splitViralHookLowerThirdText(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { primary: "", secondary: "" };
  }

  if (normalized.length <= 18 || normalized.split(" ").length <= 2) {
    return { primary: normalized, secondary: "" };
  }

  const separatorMatch = normalized.match(/^(.+?)(?:\s+[–—:|/•·-]\s+)(.+)$/u);
  if (separatorMatch) {
   const primary = separatorMatch[1].trim();
   const secondary = separatorMatch[2].trim();
   if (primary && secondary && primary !== secondary) {
     return { primary, secondary };
   }
  }

  const words = normalized.split(" ");
  if (words.length <= 1) {
   return { primary: normalized, secondary: "" };
  }

  let bestPrimary = normalized;
  let bestSecondary = "";
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 1; index < words.length; index++) {
   const primary = words.slice(0, index).join(" ");
   const secondary = words.slice(index).join(" ");
   if (!primary || !secondary || primary === secondary) continue;
   const longestLine = Math.max(primary.length, secondary.length);
   const imbalance = Math.abs(primary.length - secondary.length);
   const overflowPenalty = Math.max(0, longestLine - 28) * 8;
   const score = imbalance + overflowPenalty;
   if (score < bestScore) {
     bestScore = score;
     bestPrimary = primary;
     bestSecondary = secondary;
   }
  }

  if (bestSecondary) {
    return { primary: bestPrimary, secondary: bestSecondary };
  }

  const midpoint = Math.max(1, Math.floor(words.length / 2));
  const fallbackPrimary = words.slice(0, midpoint).join(" ");
  const fallbackSecondary = words.slice(midpoint).join(" ");
  if (fallbackPrimary && fallbackSecondary && fallbackPrimary !== fallbackSecondary) {
    return { primary: fallbackPrimary, secondary: fallbackSecondary };
  }

  return { primary: normalized, secondary: "" };
}

export function resolveViralHookLowerThirdLayout(
  text: string,
  ctx: TextMeasurer,
  maxBarWidth: number
) {
  const { primary, secondary } = splitViralHookLowerThirdText(text);
  const maxLabelLength = Math.max(primary.length, secondary.length, 1);
  const widthBias = secondary
    ? 1.01 - Math.min(maxLabelLength, 60) * 0.0026
    : 1.03 - Math.min(maxLabelLength, 48) * 0.0022;
  const barWidth = Math.round(Math.max(maxBarWidth * Math.max(0.84, Math.min(0.995, widthBias)), maxBarWidth * 0.84));
  const paddingX = Math.round(Math.max(22, Math.min(30, barWidth * 0.075)));
  const targetTextWidth = Math.max(200, barWidth - paddingX * 2);
  const fontSize = Math.round(
    fitFontSizeToWidth(
      ctx,
      primary || secondary || text.trim(),
      targetTextWidth,
      secondary ? 36 : 40,
      secondary ? 56 : 60,
      "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    )
  );

  return {
    primary,
    secondary,
    barWidth,
    barHeight: 84,
    barGap: 8,
    paddingX,
    fontSize,
  };
}

export function getViralHookLowerThirdState(frame: number, durationInFrames: number) {
  const safeDuration = Math.max(durationInFrames, 36);
  const topOutStart = Math.max(24, safeDuration - 20);
  const bottomOutStart = Math.max(28, safeDuration - 24);
  const topReveal = getReveal(frame, 0, 20, topOutStart, safeDuration);
  const bottomReveal = getReveal(frame, 4, 24, bottomOutStart, Math.max(4, safeDuration - 4));
  const visibility = Math.max(topReveal, bottomReveal);

  return {
    topReveal,
    bottomReveal,
    opacity: visibility,
    translateX: (1 - visibility) * 52,
  };
}
