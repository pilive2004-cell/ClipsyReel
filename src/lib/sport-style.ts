import { GpxRouteStats, ReelTitleColor, ReelTitleFont, ReelTitleSize, SportTelemetry } from "@/types";
import { filterCoherentDisplayTexts, isCoherentDisplayText } from "@/lib/display-text";

export type SportHookTheme = "sport" | "premium" | "offroad";
export type SportHookEffect = "slide-left" | "slide-right" | "scratch" | "terrain" | "dust" | "scale";

export interface SportHookBeat {
  text: string;
  label: string;
  title: string;
  subtitle: string;
  accent: "white" | "orange" | "green" | "sand";
  effect: SportHookEffect;
  theme: SportHookTheme;
  align: "left" | "right";
  font: ReelTitleFont;
  size: ReelTitleSize;
  color: ReelTitleColor;
}

export interface SportHookWindow extends SportHookBeat {
  start: number;
  end: number;
}

export type SportCropFocus =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "upper-left"
  | "upper-right"
  | "lower-left"
  | "lower-right";

export interface SportCollageCard {
  start: number;
  end: number;
  sourceSegmentIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  label: string;
  tone: "orange" | "green" | "sand";
  cropFocus: SportCropFocus;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function normalizeUpper(text: string) {
  return text
    .trim()
    .replace(/[|/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function compactDistance(distanceKm?: number | null) {
  if (!distanceKm || !Number.isFinite(distanceKm)) return null;
  const rounded = distanceKm >= 100 ? Math.round(distanceKm) : Math.round(distanceKm * 10) / 10;
  return `${rounded} KM`;
}

function compactElevation(elevationGainM?: number | null) {
  if (!elevationGainM || !Number.isFinite(elevationGainM)) return null;
  return `${Math.round(elevationGainM)} M D+`;
}

function compactSpeed(maxSpeedKmh?: number | null) {
  if (!maxSpeedKmh || !Number.isFinite(maxSpeedKmh)) return null;
  return `${Math.round(maxSpeedKmh)} KM/H`;
}

function compactDuration(durationLabel?: string | null) {
  if (!durationLabel || durationLabel === "—") return null;
  return normalizeUpper(durationLabel).replace(/\s+/g, "");
}

function routeToken(routeLabel?: string | null) {
  if (!routeLabel || !isCoherentDisplayText(routeLabel)) return null;
  const normalized = normalizeUpper(routeLabel);
  const parts = normalized.split(/[,/]/).map((part) => part.trim()).filter(Boolean);
  const candidate = parts[parts.length - 1] ?? normalized;
  const words = candidate.split(/\s+/).filter(Boolean);
  return words.slice(0, words.length > 2 ? 2 : words.length).join(" ");
}

function locationHeadline(routeLabel?: string | null) {
  if (!routeLabel || !isCoherentDisplayText(routeLabel)) return null;
  const normalized = normalizeUpper(routeLabel);
  const parts = normalized.split(/[,/]/).map((part) => part.trim()).filter(Boolean);
  return (parts[parts.length - 1] ?? normalized).slice(0, 28);
}

function estimatePassCount(distanceKm?: number | null, elevationGainM?: number | null) {
  if (!distanceKm || !elevationGainM || !Number.isFinite(distanceKm) || !Number.isFinite(elevationGainM)) return null;
  const passEstimate = Math.round(elevationGainM / 350 + distanceKm / 85);
  return passEstimate >= 2 ? passEstimate : null;
}

function deriveTerrainWords(routeLabel?: string | null, fallbackText?: string | null) {
  const source = `${routeLabel ?? ""} ${fallbackText ?? ""}`.toUpperCase();
  const words: string[] = [];
  if (/\bMUD\b/.test(source)) words.push("MUD");
  if (/\bROCK|ROCKS|STONE|CLIFF\b/.test(source)) words.push("ROCKS");
  if (/\bDUST|DUNE|DESERT|SAND\b/.test(source)) words.push("DUST");
  if (/\bGRAVEL|TRAIL|OFFROAD|RALLY\b/.test(source)) words.push("GRAVEL");
  return words.slice(0, 3);
}

function detectHookTheme({
  routeLabel,
  fallbackText,
  distance,
  elevation,
}: {
  routeLabel?: string | null;
  fallbackText?: string | null;
  distance?: number | null;
  elevation?: number | null;
}): SportHookTheme {
  const source = `${routeLabel ?? ""} ${fallbackText ?? ""}`.toUpperCase();
  if (/\bOFFROAD|DESERT|DUST|MUD|ROCK|RALLY|DUNE|SAHARA|MOROCCO|GEORGIA|ABANO\b/.test(source)) {
    return "offroad";
  }
  if ((distance ?? 0) >= 250 || (elevation ?? 0) >= 2400 || /\bALPS|PASS|DOLOMITES|SUMMIT\b/.test(source)) {
    return "premium";
  }
  return "sport";
}

function createHookBeat({
  label,
  title,
  subtitle,
  accent,
  effect,
  theme,
  align,
  font = "bold",
  size = "md",
  color = "white",
}: Omit<SportHookBeat, "text" | "font" | "size" | "color"> &
  Partial<Pick<SportHookBeat, "font" | "size" | "color">>): SportHookBeat {
  return {
    text: `${title} ${subtitle}`.trim(),
    label,
    title,
    subtitle,
    accent,
    effect,
    theme,
    align,
    font,
    size,
    color,
  };
}

function buildUserTextBeats(fallbackText?: string | null, theme: SportHookTheme = "sport"): SportHookBeat[] {
  const normalized = fallbackText && isCoherentDisplayText(fallbackText) ? fallbackText.trim() : "";
  if (!normalized) {
    return fallbackHookBeats(fallbackText, theme);
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallbackHookBeats(fallbackText, theme);

  const chunks = words.length <= 3
    ? [words.join(" ")]
    : [
        words.slice(0, Math.ceil(words.length / 3)).join(" "),
        words.slice(Math.ceil(words.length / 3), Math.ceil((words.length * 2) / 3)).join(" "),
        words.slice(Math.ceil((words.length * 2) / 3)).join(" "),
      ].filter(Boolean);

  return chunks.slice(0, 3).map((chunk, index) => createHookBeat({
    label: "",
    title: chunk,
    subtitle: "",
    accent: index === 1 ? "orange" : index === 2 ? "sand" : "white",
    effect: index === 0 ? "scratch" : index === 1 ? "terrain" : "dust",
    theme,
    align: index === 1 ? "right" : "left",
  }));
}

function buildCustomTextBeatsWithStyles(
  customTexts: string[] = [],
  theme: SportHookTheme = "sport",
  fonts: ReelTitleFont[] = [],
  sizes: ReelTitleSize[] = [],
  colors: ReelTitleColor[] = []
): SportHookBeat[] {
  const normalized = filterCoherentDisplayTexts(customTexts).slice(0, 3);
  if (normalized.length === 0) {
    return fallbackHookBeats(undefined, theme);
  }

  return normalized.map((text, index) => createHookBeat({
    label: "",
    title: text.trim(),
    subtitle: "",
    accent: index === 1 ? "orange" : index === 2 ? "sand" : "white",
    effect: index === 0 ? "scratch" : index === 1 ? "terrain" : "dust",
    theme,
    align: index === 1 ? "right" : "left",
    font: fonts[index] ?? "bold",
    size: sizes[index] ?? "md",
    color: colors[index] ?? "white",
  }));
}

function fallbackHookBeats(fallbackText?: string | null, theme: SportHookTheme = "sport"): SportHookBeat[] {
  const normalized = fallbackText && isCoherentDisplayText(fallbackText) ? normalizeUpper(fallbackText) : "";
  if (!normalized) {
    return [
      createHookBeat({ label: "", title: "SPORT MODE", subtitle: "", accent: "white", effect: "scratch", theme, align: "left" }),
      createHookBeat({ label: "", title: "FULL SEND", subtitle: "", accent: "orange", effect: "terrain", theme, align: "right" }),
      createHookBeat({ label: "", title: "OFFROAD", subtitle: "", accent: "sand", effect: "dust", theme, align: "left" }),
    ];
  }

  return buildUserTextBeats(fallbackText, theme);
}

export function buildSportHookSequence({
  routeLabel,
  gpxStats,
  sportTelemetry,
  fallbackText,
  customTexts,
  overlayFonts,
  overlaySizes,
  overlayColors,
}: {
  routeLabel?: string | null;
  gpxStats?: GpxRouteStats | null;
  sportTelemetry?: SportTelemetry | null;
  fallbackText?: string | null;
  customTexts?: string[] | null;
  overlayFonts?: ReelTitleFont[] | null;
  overlaySizes?: ReelTitleSize[] | null;
  overlayColors?: ReelTitleColor[] | null;
}): SportHookBeat[] {
  const distance = compactDistance(sportTelemetry?.distanceKm ?? gpxStats?.distanceKm ?? null);
  const elevation = compactElevation(sportTelemetry?.elevationGainM ?? gpxStats?.elevationGainM ?? null);
  const duration = compactDuration(sportTelemetry?.durationLabel ?? gpxStats?.durationLabel ?? null);
  const speed = compactSpeed(sportTelemetry?.maxSpeedKmh ?? null);
  const terrain = routeToken(routeLabel);
  const headline = locationHeadline(routeLabel);
  const terrainWords = deriveTerrainWords(routeLabel, fallbackText);
  const passCount = estimatePassCount(sportTelemetry?.distanceKm ?? gpxStats?.distanceKm ?? null, sportTelemetry?.elevationGainM ?? gpxStats?.elevationGainM ?? null);
  const theme = detectHookTheme({
    routeLabel,
    fallbackText,
    distance: sportTelemetry?.distanceKm ?? gpxStats?.distanceKm ?? null,
    elevation: sportTelemetry?.elevationGainM ?? gpxStats?.elevationGainM ?? null,
  });
  const normalizedCustomTexts = filterCoherentDisplayTexts(customTexts ?? []);
  const fallbackHeadline = fallbackText && isCoherentDisplayText(fallbackText) ? normalizeUpper(fallbackText) : "";
  const preferredHeadline = fallbackHeadline || headline || terrain || "SPORT MODE";

  if (normalizedCustomTexts.length > 0) {
    return buildCustomTextBeatsWithStyles(
      normalizedCustomTexts,
      theme,
      overlayFonts ?? [],
      overlaySizes ?? [],
      overlayColors ?? []
    );
  }

  if (fallbackHeadline) {
    return buildUserTextBeats(fallbackText, theme);
  }

  const candidates: SportHookBeat[][] = [
    (distance || preferredHeadline || elevation || duration)
      ? [
          createHookBeat({
            label: "",
            title: preferredHeadline,
            subtitle: "",
            accent: "white",
            effect: "scratch",
            theme,
            align: "left",
          }),
          createHookBeat({
            label: "",
            title: distance || duration || "GPX ROUTE",
            subtitle: "",
            accent: "orange",
            effect: "terrain",
            theme,
            align: "right",
          }),
          createHookBeat({
            label: "",
            title: elevation || speed || "FULL SEND",
            subtitle: "",
            accent: theme === "offroad" ? "sand" : "green",
            effect: "dust",
            theme,
            align: "left",
          }),
        ]
      : [],
    passCount && duration
      ? [
          createHookBeat({ label: "", title: `${passCount} PASSES`, subtitle: "", accent: "white", effect: "scratch", theme, align: "left" }),
          createHookBeat({ label: "", title: duration, subtitle: "", accent: "orange", effect: "terrain", theme, align: "right" }),
          createHookBeat({ label: "", title: headline ?? (terrain ?? "OFFROAD"), subtitle: "", accent: "sand", effect: "dust", theme, align: "left" }),
        ]
      : [],
    terrainWords.length >= 2
      ? [
          createHookBeat({ label: "", title: terrainWords[0], subtitle: "", accent: "sand", effect: "scratch", theme, align: "left" }),
          createHookBeat({ label: "", title: distance ?? (speed ?? "LIVE PACE"), subtitle: "", accent: "white", effect: "terrain", theme, align: "right" }),
          createHookBeat({ label: "", title: elevation ?? "ROUTE LOCK", subtitle: "", accent: "orange", effect: "dust", theme, align: "left" }),
        ]
      : [],
  ];

  const best = candidates.find((candidate) => candidate.length === 3);
  return best ?? fallbackHookBeats(fallbackText, theme);
}

export function planSportHookWindows(
  beats: SportHookBeat[],
  totalDuration: number,
  introDuration: number,
  outroDuration: number,
  minimumStartSeconds = 0
): SportHookWindow[] {
  if (beats.length === 0) return [];
  const minimumLeadIn = Math.min(0.48, Math.max(0.36, totalDuration * 0.07));
  const contentStart = Math.max(
    minimumLeadIn,
    minimumStartSeconds,
    introDuration > 0 ? Math.min(introDuration * 0.75, 0.9) : 0.08
  );
  const contentEnd = Math.max(contentStart, totalDuration - Math.max(0.3, outroDuration + 0.2));
  const available = Math.max(0, contentEnd - contentStart);
  if (available < 1.2) return [];

  const beatDuration = Math.min(available, clamp(available / Math.max(1, beats.length), 1.8, 4.2));
  const leftover = Math.max(0, available - beatDuration * beats.length);
  const gap = beats.length > 1 ? leftover / (beats.length - 1) : 0;

  return beats.map((beat, index) => {
    const start = contentStart + index * (beatDuration + gap);
    const end = Math.min(contentEnd, start + beatDuration);
    return {
      ...beat,
      start,
      end,
    };
  }).filter((window) => window.end > window.start + 0.3);
}

export function resolveSportHookPalette(theme: SportHookTheme, color: ReelTitleColor) {
  const isWhite = color === "white";
  const baseLight = theme === "offroad" ? "rgba(241,238,231,0.72)" : "rgba(245,247,250,0.72)";
  const baseDark = "rgba(11,15,22,0.74)";

  const tones: Record<ReelTitleColor, { text: string; accent: string; outline: string; darkSurface?: boolean }> = {
    white: { text: "#ffffff", accent: "#f8fafc", outline: "rgba(255,255,255,0.34)", darkSurface: true },
    gold: { text: "#92400e", accent: "#f59e0b", outline: "rgba(245,158,11,0.35)" },
    coral: { text: "#9a3412", accent: "#fb923c", outline: "rgba(251,146,60,0.35)" },
    cyan: { text: "#155e75", accent: "#22d3ee", outline: "rgba(34,211,238,0.35)" },
    lime: { text: "#4d7c0f", accent: "#84cc16", outline: "rgba(132,204,22,0.35)" },
    violet: { text: "#6d28d9", accent: "#a78bfa", outline: "rgba(167,139,250,0.35)" },
    pink: { text: "#be185d", accent: "#f472b6", outline: "rgba(244,114,182,0.35)" },
    red: { text: "#b91c1c", accent: "#ef4444", outline: "rgba(239,68,68,0.35)" },
    blue: { text: "#1d4ed8", accent: "#60a5fa", outline: "rgba(96,165,250,0.35)" },
    emerald: { text: "#047857", accent: "#34d399", outline: "rgba(52,211,153,0.35)" },
    peach: { text: "#9a3412", accent: "#fdba74", outline: "rgba(253,186,116,0.35)" },
    silver: { text: "#334155", accent: "#cbd5e1", outline: "rgba(203,213,225,0.35)" },
  };

  const selected = tones[color];
  return {
    labelFill: isWhite ? "#111827" : selected.accent,
    labelText: isWhite ? "#ffffff" : "#0b0f16",
    mainFill: selected.darkSurface ? baseDark : baseLight,
    mainText: selected.text,
    subtitleFill: selected.darkSurface ? "rgba(255,255,255,0.14)" : "rgba(11,15,22,0.74)",
    subtitleText: selected.darkSurface ? "#ffffff" : "#f8fafc",
    accent: selected.accent,
    outline: selected.outline,
  };
}

export function planSportCollageCards(
  totalDuration: number,
  introDuration: number,
  outroDuration: number,
  sourceSegmentCount: number
): SportCollageCard[] {
  if (sourceSegmentCount <= 0) return [];

  const contentStart = Math.max(0.55, introDuration + 0.4);
  const contentEnd = Math.max(contentStart, totalDuration - Math.max(0.45, outroDuration + 0.35));
  const available = contentEnd - contentStart;
  if (available < 4.2) return [];

  const presets: Array<Omit<SportCollageCard, "start" | "end" | "sourceSegmentIndex"> & { startAt: number; duration: number }> = [
    { startAt: 0.18, duration: 0.12, x: 0.6, y: 0.12, width: 0.26, height: 0.16, rotate: -4, label: "PIP", tone: "sand", cropFocus: "lower-right" as const },
    { startAt: 0.24, duration: 0.11, x: 0.08, y: 0.58, width: 0.3, height: 0.18, rotate: 3, label: "ROUTE", tone: "orange", cropFocus: "upper-left" as const },
    { startAt: 0.34, duration: 0.13, x: 0.62, y: 0.32, width: 0.24, height: 0.28, rotate: -2, label: "HIGHLIGHT", tone: "green", cropFocus: "bottom" as const },
    { startAt: 0.44, duration: 0.1, x: 0.12, y: 0.14, width: 0.22, height: 0.14, rotate: -5, label: "IMPACT", tone: "sand", cropFocus: "lower-left" as const },
    { startAt: 0.56, duration: 0.14, x: 0.1, y: 0.28, width: 0.32, height: 0.22, rotate: 2, label: "SPEED", tone: "orange", cropFocus: "right" as const },
    { startAt: 0.66, duration: 0.12, x: 0.56, y: 0.68, width: 0.28, height: 0.12, rotate: -2, label: "MAP", tone: "green", cropFocus: "center" as const },
    { startAt: 0.82, duration: 0.12, x: 0.58, y: 0.18, width: 0.24, height: 0.16, rotate: 4, label: "HERO", tone: "sand", cropFocus: "top" as const },
    { startAt: 0.9, duration: 0.1, x: 0.14, y: 0.64, width: 0.34, height: 0.13, rotate: -1, label: "FINAL", tone: "orange", cropFocus: "left" as const },
  ];

  return presets
    .map((preset, index) => {
      const start = contentStart + available * preset.startAt;
      const duration = clamp(available * preset.duration, 1.05, 2.7);
      return {
        ...preset,
        start,
        end: Math.min(contentEnd, start + duration),
        sourceSegmentIndex: (index + 1) % sourceSegmentCount,
      };
    })
    .filter((card) => card.end - card.start >= 0.85);
}
