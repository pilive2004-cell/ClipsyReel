import { TransitionId } from "@/transitions/transition.types";

/**
 * GLOBAL FORBIDDEN TRANSITION LIST — product requirement, applies to every
 * style (Adventure, Viral, Travel, Sport, Cinematic, Luxury) with no
 * exception. These directional wipe/slide/cover/reveal filters, plus the
 * plain `dissolve`, read as cheap/dated "slideshow" transitions and must
 * never be selected by `TransitionSelector`, the fallback pool
 * (`data/transitions.ts`), timeline generation, the automatic pattern
 * selector, transition presets, or the rendering engine.
 *
 * The real ffmpeg xfade filter names are lowercase (`wipeleft`, not
 * `wipeLeft`) — this list is kept in the product's original casing for easy
 * auditing/grepping, and compared case-insensitively at runtime via
 * `isForbiddenXfadeTransition`.
 */
export const FORBIDDEN_TRANSITIONS = [
  "wipeLeft",
  "wipeRight",
  "wipeUp",
  "wipeDown",
  "slideLeft",
  "slideRight",
  "rectCrop",
  "dissolve",
  "wipeTL",
  "wipeTR",
  "wipeBL",
  "wipeBR",
  "squeezeV",
  "squeezeH",
  "coverLeft",
  "coverRight",
  "coverUp",
  "coverDown",
  "revealLeft",
  "revealRight",
  "revealUp",
  "revealDown",
] as const;

const FORBIDDEN_XFADE_FILTERS = new Set(FORBIDDEN_TRANSITIONS.map((name) => name.toLowerCase()));

/**
 * A second, permanent app-specific ban — separate from the product's
 * official `FORBIDDEN_TRANSITIONS` list above because the user's complaint
 * about it long predates that list and is about a specific *visual*
 * grievance, not the "cheap slideshow wipe" family: `radial` renders as a
 * rotating clock-hand / compass-needle sweep, which reads as an amateur
 * PowerPoint-style effect and does not fit ANY of the app's 6 styles. This
 * was already removed once (see `data/transitions.ts` history) but was
 * accidentally re-introduced for Viral's `beatCut` in a later transition
 * remap — hence tracking it as its own explicit, tested constant so it can
 * never silently creep back in again.
 */
const PERMANENTLY_BANNED_XFADE_FILTERS = new Set(["radial"]);

/** Case-insensitive check against the global forbidden-transition list (+ the permanently-banned `radial` clock-hand effect) — used to guard every layer that can produce a real ffmpeg xfade filter name. */
export function isForbiddenXfadeTransition(name: string): boolean {
  const normalized = name.toLowerCase();
  return FORBIDDEN_XFADE_FILTERS.has(normalized) || PERMANENTLY_BANNED_XFADE_FILTERS.has(normalized);
}

/**
 * The real ffmpeg `xfade` filter names this app is willing to render.
 *
 * The 57 conceptual `TransitionId`s from the style system describe an
 * *editorial intention* (mountain reveal, corner attack, silk fade, whip
 * pan, motion blur swipe, …) — this map is the bridge to the actual
 * ffmpeg.wasm `xfade` filter, which ships with a large built-in transition
 * library (no extra codecs/shaders required, just a different
 * `transition=` parameter value on the same filter).
 *
 * None of the names below appear in `FORBIDDEN_TRANSITIONS` above — no
 * directional wipe/slide/cover/reveal filter and no plain `dissolve` is ever
 * used, in any style.
 *
 * Two deliberately different palettes are used:
 *  - Adventure / Travel / Cinematic / Luxury stay on a small, restrained
 *    "premium-looking" set (`fade`, `fadegrays`, `zoomin`, `fadeblack`,
 *    `fadewhite`, soft opens/closes) — hard directional motifs read as cheap
 *    or dated for those calmer, more elegant styles.
 *  - Viral / Sport get a wider, punchier palette (soft directional
 *    smooth-slides, slice-wipes, blur-wipes, pixelize) — this is exactly the
 *    "TikTok-style" energy those two styles are supposed to have, so
 *    excluding it there would be the mistake, not including it. Note these
 *    still avoid the forbidden hard `wipe*`/`slide*`/`cover*`/`reveal*`
 *    filters — `smoothleft`/`smoothright` (a softened, blurred slide) and
 *    `hlslice`/`hrslice`/`vdslice` (multi-strip slice bursts) are distinct
 *    ffmpeg filters that are NOT on the forbidden list.
 */
export type XfadeFilterName =
  | "fade"
  | "fadegrays"
  | "zoomin"
  | "fadeblack"
  | "fadewhite"
  | "smoothleft"
  | "smoothright"
  | "horzopen"
  | "vertopen"
  | "vertclose"
  | "hlslice"
  | "hrslice"
  | "vdslice"
  | "hblur"
  | "pixelize"
  | "distance"
  | "circleopen"
  | "circleclose";

/**
 * Exhaustive per-id mapping — TypeScript enforces that every `TransitionId`
 * has an entry, so adding a new conceptual transition without updating this
 * map is a compile error, not a silent gap.
 */
export const XFADE_MAPPING: Record<TransitionId, XfadeFilterName> = {
  // --- Adventure: terrain-anchored reveals read as a push/zoom; softer contour blends now read as a gray-fade or an open/reveal instead of a plain dissolve ---
  mountainReveal: "zoomin",
  terrainMask: "fadegrays",
  cloudWipe: "horzopen",
  elevationLift: "zoomin",
  valleyReveal: "zoomin",
  cinematicSpeedRamp: "fade",
  mapToTerrainDive: "zoomin",
  ridgeLineReveal: "vertopen",

  // --- Viral: everything is punchy and visibly different from a plain cut,
  // and — critically — visibly different FROM EACH OTHER. The 5 *core*
  // transitions (flashCut/beatCut/zoomSmash/whipPan/hyperSpeedRamp) used to
  // include 3 filters that all read as "a horizontal directional
  // slice/wipe" (beatCut: hlslice, hyperSpeedRamp: hrslice, whipPan:
  // wipeleft) — conceptually distinct `TransitionId`s, but visually almost
  // indistinguishable to a viewer, which is exactly the "it's always the
  // same left/right swipe" complaint even though the selector itself was
  // genuinely rotating between different ids. `wipeleft`/`squeezeh` are also
  // now on the GLOBAL FORBIDDEN list, so whipPan/hyperSpeedRamp were
  // remapped to `smoothleft` (a softened, blurred slide — visually a "whip",
  // but not the forbidden hard `wipeleft`) and `vdslice` (a fast multi-strip
  // vertical burst — reads as a speed ramp, not the forbidden `squeezeh`).
  // `beatCut` must NEVER be `radial` — a long-standing, explicit user
  // requirement ("enlever les transitions qui tournent style rotation
  // d'aiguille") that a rotating clock-hand/compass-needle sweep never be
  // used in any style; `radial` is now on the separate, permanently-banned
  // list in `PERMANENTLY_BANNED_XFADE_FILTERS` above precisely so this can
  // never silently regress again. `hlslice` (a fast horizontal slice burst)
  // is the replacement — a hard, punchy, non-rotational beat-cut motif.
  // Each core transition now maps to a structurally different xfade motif: a
  // hard black flash, a horizontal slice burst, a zoom punch, a soft
  // directional whip-slide, and a fast vertical slice burst — no two of the
  // 5 core filters share a visual family anymore, and none is forbidden or
  // banned.
  flashCut: "fadeblack",
  beatCut: "hlslice",
  zoomSmash: "zoomin",
  whipPan: "smoothleft",
  motionBlurSwipe: "hblur",
  hyperSpeedRamp: "vdslice",
  glitchPulse: "pixelize",
  impactZoom: "zoomin",
  // snapToBeat shares beatCut's "beat" family by design (both are
  // beat-synced hard cuts) but must not render identically — `circleclose`
  // keeps the same circular/non-directional motif as `radial` without
  // being pixel-for-pixel the same motion.
  snapToBeat: "circleclose",
  textPopReveal: "fadewhite",

  // --- Travel: continuity and flow now read as a plain fade/soft open instead of the forbidden `dissolve`; reveals as a gentle zoom; the warm daylight beat as a soft fade ---
  crossDissolve: "fade",
  directionMatch: "smoothright",
  horizonMatch: "horzopen",
  landscapeReveal: "zoomin",
  locationMorph: "circleopen",
  softSwipe: "smoothleft",
  parallaxDrift: "distance",
  mapZoomToPlace: "zoomin",
  daylightBlend: "fade",

  // --- Sport: aggressive and visibly action-driven — hard black-flash impacts, soft attack-slides for corners (never the forbidden hard `wiperight`), a blur-wipe for velocity, pixelize for the shake/shock hit ---
  impactCut: "fadeblack",
  jumpCut: "fadeblack",
  velocityBlur: "hblur",
  cornerAttack: "smoothright",
  trackingSnap: "zoomin",
  accelerationRamp: "distance",
  brakeHitCut: "fadeblack",
  dirtSwipe: "hrslice",
  shockShakeCut: "pixelize",
  povSnap: "zoomin",

  // --- Cinematic: story-motivated darkness is a black fade, push/reveal beats are a slow zoom, everything else a patient fade or circular orbit blend (never the forbidden `dissolve`) ---
  fadeThroughDarkness: "fadeblack",
  epicReveal: "zoomin",
  cinematicPush: "zoomin",
  orbitBlend: "circleclose",
  focusShift: "fade",
  slowSpeedRamp: "fade",
  atmosphericFade: "fade",
  shadowWipe: "fadeblack",
  foregroundMask: "vertclose",
  timeOfDayBlend: "fade",

  // --- Luxury: light/reflection ideas read as a white fade, organic detail continuity as a gentle gray-fade/soft blend, everything else a slow, calm fade (never the forbidden `dissolve`) ---
  silkFade: "fadewhite",
  lightSweep: "fadewhite",
  reflectionMatch: "fadegrays",
  detailToDetail: "smoothleft",
  floatingOrbit: "vertopen",
  softParallax: "distance",
  elegantCrossfade: "fade",
  shadowToLight: "fadewhite",
  premiumReveal: "fadewhite",
  slowGradientFade: "fade",

  // --- Shared fades: real, visible xfade blends — never just a metadata
  // label. `fadeIn`/`fadeOut` both render as a soft even fade (the
  // "direction" is conceptual/naming only — a single xfade call already
  // blends outgoing-into-incoming, which reads as both a fade-out of the
  // previous shot AND a fade-in of the next one at once); `crossFade` is a
  // soft circular open (never the forbidden `dissolve`); `softFade` reuses
  // the same gentle "fade" filter but
  // is scored/durationed for calmer moments; `fadeThroughBlack` is a hard
  // black bookend for a stronger separation beat. ---
  fadeIn: "fade",
  fadeOut: "fade",
  crossFade: "fade",
  softFade: "fade",
  fadeThroughBlack: "fadeblack",
};

/**
 * Resolves a conceptual `TransitionId` decision down to the real ffmpeg
 * `xfade` filter name to render.
 *
 * Defensively re-checks against the global forbidden-transition list at
 * call time (requirement #3): the `XfadeFilterName` type itself already
 * makes it a compile error to map any `TransitionId` to a forbidden filter,
 * so this should be unreachable — but it's kept as a hard runtime guarantee
 * in case a future edit ever reintroduces one by mistake. If it ever did
 * fire, the caller (`video-engine.ts`) already falls back to the
 * safe/randomized pool in `data/transitions.ts` on any thrown error — which
 * is itself guaranteed forbidden-free (see that file) — so this doubles as
 * the `chooseAlternativeTransition()` step from the spec.
 */
export function mapTransitionToXfade(id: TransitionId): XfadeFilterName {
  const filter = XFADE_MAPPING[id];
  if (isForbiddenXfadeTransition(filter)) {
    throw new Error(`Forbidden transition "${filter}" selected for transition id "${id}" — this must never render.`);
  }
  return filter;
}

