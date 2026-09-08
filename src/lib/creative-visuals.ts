import { Typography } from "@/data/creativeStyleProfiles";

/**
 * Canvas-generated overlay PNGs used by the Creative Style Engine's render
 * pipeline (`video-engine.ts`). Mirrors the existing `generateWatermarkPng`
 * pattern: everything is drawn client-side on an offscreen `<canvas>` (no
 * server round-trip, no bundled font/image assets needed) and exported as a
 * `Uint8Array` PNG that ffmpeg.wasm then composites via its `overlay` filter
 * — so every treatment below is burned into the real exported MP4, not just
 * a CSS effect in the preview UI.
 *
 * FUTURE: Remotion could replace these flat, canvas-drawn cards with fully
 * animated React compositions (animated map intro actually drawing the GPX
 * route line, a true multi-frame polaroid collage, animated typography).
 */

function fontStack(typography: Typography): string {
  switch (typography) {
    case "bold-sans":
      return "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
    case "elegant-serif":
      return "Georgia, 'Times New Roman', serif";
    case "technical-mono":
      return "'Courier New', ui-monospace, monospace";
  }
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  return { canvas, ctx };
}

/** Wraps `text` onto multiple centered lines that fit within `maxWidth`. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A real GPX lat/lng point, downsampled for drawing (see `pickRoutePreviewPoints` in `gpx.ts`). */
export interface RoutePoint {
  lat: number;
  lng: number;
}

const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TILE_SIZE = 256;
const tileImageCache = new Map<string, Promise<HTMLImageElement>>();

interface SatelliteRouteTexture {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  projectedPoints: Array<{ x: number; y: number }>;
  projectedFocusPoints: Array<{ x: number; y: number }>;
}

/**
 * A full-frame opaque route intro card — used as the Adventure/Travel styles'
 * GPX route-stat intro. When real parsed GPX `points` are supplied, the
 * actual route shape is plotted (fitted/normalized into a map frame) so the
 * exact ride/hike the user uploaded shows up in the exported MP4.
 */
export async function generateRouteCardPng(
  w: number,
  h: number,
  opts: { title: string; subtitle: string; typography: Typography; points?: RoutePoint[] | null; focusPoints?: RoutePoint[] | null }
): Promise<Uint8Array> {
  const mapTexture = await buildSatelliteRouteTexture(opts.points ?? null, opts.focusPoints ?? null, Math.round(w * 1.08), Math.round(h * 0.76));
  const { canvas } = renderRouteCardFrame(w, h, { ...opts, routeProgress: 1, showText: true, mapTexture });
  return canvasToPng(canvas);
}

/**
 * Renders a short sequence of PNG frames that progressively "draws on" the
 * real GPX route before settling on the full route with title + stats fading
 * in. The map itself stays fixed and north-up so the route reads like a
 * TravelBoast-style trace instead of a drifting drone shot.
 */
export async function generateRouteAnimationFrames(
  w: number,
  h: number,
  opts: { title: string; subtitle: string; typography: Typography; points?: RoutePoint[] | null; focusPoints?: RoutePoint[] | null; frameCount: number }
): Promise<Uint8Array[]> {
  const frames: Uint8Array[] = [];
  const hasRoute = !!opts.points && opts.points.length >= 2;
  const mapTexture = await buildSatelliteRouteTexture(opts.points ?? null, opts.focusPoints ?? null, Math.round(w * 1.08), Math.round(h * 0.76));
  // Spend ~70% of frames drawing the line on, then hold the completed route
  // for the rest while the title/subtitle fade in.
  const drawFrames = hasRoute ? Math.max(1, Math.round(opts.frameCount * 0.7)) : 0;
  for (let i = 0; i < opts.frameCount; i++) {
    const routeProgress = hasRoute ? Math.min(1, (i + 1) / drawFrames) : 1;
    const textProgress = hasRoute ? Math.max(0, Math.min(1, (i - drawFrames * 0.6) / (opts.frameCount - drawFrames * 0.6 || 1))) : 1;
    const { canvas } = renderRouteCardFrame(w, h, {
      title: opts.title,
      subtitle: opts.subtitle,
      typography: opts.typography,
      points: opts.points,
      focusPoints: opts.focusPoints,
      routeProgress,
      showText: true,
      textOpacity: textProgress,
      cameraProgress: 1,
      mapTexture,
    });
    frames.push(await canvasToPng(canvas));
  }
  return frames;
}

/** Shared drawing logic behind both the static route card and the animated route-reveal frame sequence. */
function renderRouteCardFrame(
  w: number,
  h: number,
  opts: {
    title: string;
    subtitle: string;
    typography: Typography;
    points?: RoutePoint[] | null;
    focusPoints?: RoutePoint[] | null;
    routeProgress: number;
    showText: boolean;
    textOpacity?: number;
    cameraProgress?: number;
    mapTexture?: SatelliteRouteTexture | null;
  }
) {
  const { canvas, ctx } = makeCanvas(w, h);
  const cameraProgress = Math.max(0, Math.min(1, opts.cameraProgress ?? 1));

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#06070d");
  bg.addColorStop(0.42, "#08131b");
  bg.addColorStop(1, "#05060b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  drawAtmosphericGlow(ctx, w, h);
  drawValleyDepth(ctx, w, h, cameraProgress);
  const mapTop = h * 0.1;
  const mapBottom = h * 0.57;
  const mapWidthPad = w * 0.08;
  const mapArea = { x0: mapWidthPad, y0: mapTop, x1: w - mapWidthPad, y1: mapBottom };
  drawMapCastShadow(ctx, mapArea);
  const plane = drawMapPlane(ctx, mapArea, cameraProgress);

  ctx.save();
  ctx.clip(plane);
  if (opts.mapTexture) {
    const satelliteView = computeSatelliteCameraView(opts.mapTexture);
    drawSatelliteMapTexture(ctx, mapArea, opts.mapTexture, satelliteView);
    drawCinematicMapLighting(ctx, mapArea, satelliteView);
    drawSatelliteRouteOverlay(ctx, mapArea, opts.mapTexture, satelliteView, opts.routeProgress, cameraProgress, opts.focusPoints ?? null);
  } else {
    drawTerrainRelief(ctx, mapArea, cameraProgress);
    drawTerrainMesh(ctx, mapArea, cameraProgress);
    const focusShift = getFocusCameraShift(opts.points ?? null, opts.focusPoints ?? null, mapArea, cameraProgress);
    const camShiftX = (0.5 - cameraProgress) * w * 0.05 + focusShift.x;
    const camShiftY = (1 - cameraProgress) * h * 0.03 + focusShift.y;
    ctx.translate(camShiftX, camShiftY);
    ctx.save();
    if (opts.points && opts.points.length >= 2) {
      drawRoutePolyline(ctx, opts.points, mapArea, opts.routeProgress, false);
      drawFocusMarkers(ctx, opts.points, opts.focusPoints ?? null, mapArea, cameraProgress);
    } else {
      // No real track data — fall back to a simple decorative route-line glyph so the card still reads as a "route" card.
      ctx.strokeStyle = "rgba(52, 211, 153, 0.55)";
      ctx.lineWidth = Math.max(2, w * 0.006);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const routeY = (mapArea.y0 + mapArea.y1) / 2;
      ctx.moveTo(mapArea.x0, routeY + h * 0.05);
      ctx.bezierCurveTo(w * 0.32, routeY - h * 0.06, w * 0.4, routeY + h * 0.08, w * 0.55, routeY - h * 0.02);
      ctx.bezierCurveTo(w * 0.68, routeY - h * 0.08, w * 0.74, routeY + h * 0.04, mapArea.x1, routeY);
      ctx.stroke();
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(mapArea.x0, routeY + h * 0.05, w * 0.012, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(mapArea.x1, routeY, w * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  drawRouteChrome(ctx, w, h, mapArea);

  if (!opts.showText) return { canvas, ctx };

  const textOpacity = opts.textOpacity ?? 1;
  if (textOpacity <= 0) return { canvas, ctx };
  ctx.save();
  ctx.globalAlpha = textOpacity;
  drawRouteInfoPanel(ctx, w, h, opts.title, opts.subtitle, opts.typography, opts.points ?? null);
  ctx.restore();

  return { canvas, ctx };
}

function createRouteProjector(points: RoutePoint[], area: { x0: number; y0: number; x1: number; y1: number }) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const areaW = area.x1 - area.x0;
  const areaH = area.y1 - area.y0;
  const latCorrection = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) || 1;
  const scale = Math.min(areaW / (lngSpan * latCorrection), areaH / latSpan);
  const drawnW = lngSpan * latCorrection * scale;
  const drawnH = latSpan * scale;
  const offsetX = area.x0 + (areaW - drawnW) / 2;
  const offsetY = area.y0 + (areaH - drawnH) / 2;
  return {
    areaW,
    toXY: (p: RoutePoint) => ({
      x: offsetX + (p.lng - minLng) * latCorrection * scale,
      y: offsetY + (maxLat - p.lat) * scale,
    }),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lngToWorldX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToWorldY(lat: number, zoom: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const mercator = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return mercator * TILE_SIZE * 2 ** zoom;
}

function chooseSatelliteZoom(points: RoutePoint[], targetWidth: number, targetHeight: number) {
  for (let zoom = 14; zoom >= 7; zoom--) {
    const xs = points.map((point) => lngToWorldX(point.lng, zoom));
    const ys = points.map((point) => latToWorldY(point.lat, zoom));
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    if (spanX <= targetWidth * 1.45 && spanY <= targetHeight * 1.2) return zoom;
  }
  return 7;
}

async function loadTileImage(url: string): Promise<HTMLImageElement> {
  let cached = tileImageCache.get(url);
  if (!cached) {
    cached = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load map tile: ${url}`));
      img.src = url;
    });
    tileImageCache.set(url, cached);
  }
  return cached;
}

async function buildSatelliteRouteTexture(
  points: RoutePoint[] | null,
  focusPoints: RoutePoint[] | null,
  targetWidth: number,
  targetHeight: number
) : Promise<SatelliteRouteTexture | null> {
  if (!points || points.length < 2) return null;

  try {
    const zoom = chooseSatelliteZoom(points, targetWidth, targetHeight);
    const xs = points.map((point) => lngToWorldX(point.lng, zoom));
    const ys = points.map((point) => latToWorldY(point.lat, zoom));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const padX = Math.max(96, spanX * 0.28);
    const padY = Math.max(96, spanY * 0.3);
    const tileMinX = clamp(Math.floor((minX - padX) / TILE_SIZE), 0, 2 ** zoom - 1);
    const tileMaxX = clamp(Math.floor((maxX + padX) / TILE_SIZE), 0, 2 ** zoom - 1);
    const tileMinY = clamp(Math.floor((minY - padY) / TILE_SIZE), 0, 2 ** zoom - 1);
    const tileMaxY = clamp(Math.floor((maxY + padY) / TILE_SIZE), 0, 2 ** zoom - 1);

    const mosaicWidth = (tileMaxX - tileMinX + 1) * TILE_SIZE;
    const mosaicHeight = (tileMaxY - tileMinY + 1) * TILE_SIZE;
    const { canvas: mosaic, ctx: mosaicCtx } = makeCanvas(mosaicWidth, mosaicHeight);

    await Promise.all(
      Array.from({ length: tileMaxY - tileMinY + 1 }, (_, row) =>
        Promise.all(
          Array.from({ length: tileMaxX - tileMinX + 1 }, async (_, col) => {
            const tileX = tileMinX + col;
            const tileY = tileMinY + row;
            const url = SATELLITE_TILE_URL.replace("{z}", String(zoom)).replace("{x}", String(tileX)).replace("{y}", String(tileY));
            const image = await loadTileImage(url);
            mosaicCtx.drawImage(image, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          })
        )
      )
    );

    const cropX = clamp(minX - padX - tileMinX * TILE_SIZE, 0, Math.max(0, mosaicWidth - 1));
    const cropY = clamp(minY - padY - tileMinY * TILE_SIZE, 0, Math.max(0, mosaicHeight - 1));
    const cropW = Math.min(mosaicWidth - cropX, spanX + padX * 2);
    const cropH = Math.min(mosaicHeight - cropY, spanY + padY * 2);
    const { canvas: texture, ctx } = makeCanvas(targetWidth, targetHeight);
    ctx.drawImage(mosaic, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);

    // Keep the map readable: only a light grade, not a dark cinematic wash.
    ctx.fillStyle = "rgba(6, 10, 18, 0.1)";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    const vignette = ctx.createRadialGradient(targetWidth * 0.52, targetHeight * 0.42, targetWidth * 0.08, targetWidth * 0.52, targetHeight * 0.42, targetWidth * 0.7);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(4, 6, 12, 0.14)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    const cropLeftWorld = tileMinX * TILE_SIZE + cropX;
    const cropTopWorld = tileMinY * TILE_SIZE + cropY;
    const projectedPoints = points.map((point) => ({
      x: ((lngToWorldX(point.lng, zoom) - cropLeftWorld) / cropW) * targetWidth,
      y: ((latToWorldY(point.lat, zoom) - cropTopWorld) / cropH) * targetHeight,
    }));
    const projectedFocusPoints = (focusPoints ?? []).map((point) => ({
      x: ((lngToWorldX(point.lng, zoom) - cropLeftWorld) / cropW) * targetWidth,
      y: ((latToWorldY(point.lat, zoom) - cropTopWorld) / cropH) * targetHeight,
    }));
    return {
      canvas: texture,
      width: targetWidth,
      height: targetHeight,
      projectedPoints,
      projectedFocusPoints,
    };
  } catch (error) {
    console.warn("Satellite map texture generation failed, using stylized terrain fallback", error);
    return null;
  }
}

function getPointAtProgress2D(points: Array<{ x: number; y: number }>, progress: number) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const clamped = Math.max(0, Math.min(1, progress));
  const exactIndex = clamped * (points.length - 1);
  const index = Math.floor(exactIndex);
  const t = exactIndex - index;
  const a = points[index];
  const b = points[Math.min(index + 1, points.length - 1)];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, angle: number) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

function computeSatelliteCameraView(texture: SatelliteRouteTexture) {
  return {
    center: {
      x: texture.width / 2,
      y: texture.height / 2,
    },
    rotation: 0,
    zoom: 1,
    progress: 1,
    pitch: 1,
    bank: 0,
    verticalShift: 0,
  };
}

function getFocusCameraShift(
  points: RoutePoint[] | null,
  focusPoints: RoutePoint[] | null,
  area: { x0: number; y0: number; x1: number; y1: number },
  cameraProgress: number
) {
  if (!points || points.length < 2 || !focusPoints || focusPoints.length === 0) return { x: 0, y: 0 };
  const projector = createRouteProjector(points, area);
  const projected = focusPoints.map(projector.toXY);
  const centroid = projected.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  centroid.x /= projected.length;
  centroid.y /= projected.length;
  const centerX = (area.x0 + area.x1) / 2;
  const centerY = (area.y0 + area.y1) / 2;
  return {
    x: (centerX - centroid.x) * 0.32 * cameraProgress,
    y: (centerY - centroid.y) * 0.24 * cameraProgress,
  };
}

function drawAtmosphericGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const skyGlow = ctx.createRadialGradient(w * 0.5, h * 0.14, w * 0.04, w * 0.5, h * 0.14, w * 0.62);
  skyGlow.addColorStop(0, "rgba(56,189,248,0.16)");
  skyGlow.addColorStop(0.5, "rgba(22,163,74,0.07)");
  skyGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = skyGlow;
  ctx.fillRect(0, 0, w, h);

  const bottomGlow = ctx.createRadialGradient(w * 0.5, h * 0.82, w * 0.08, w * 0.5, h * 0.82, w * 0.45);
  bottomGlow.addColorStop(0, "rgba(16,185,129,0.12)");
  bottomGlow.addColorStop(1, "rgba(16,185,129,0)");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, w, h);
}

function drawValleyDepth(ctx: CanvasRenderingContext2D, w: number, h: number, cameraProgress: number) {
  const haze = ctx.createLinearGradient(0, 0, 0, h * 0.78);
  haze.addColorStop(0, "rgba(56,189,248,0.16)");
  haze.addColorStop(0.42, "rgba(20,30,45,0.11)");
  haze.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h * 0.78);

  const parallaxA = (1 - cameraProgress) * h * 0.055;
  const parallaxB = (1 - cameraProgress) * h * 0.09;
  const horizon = new Path2D();
  horizon.moveTo(0, h * 0.17);
  horizon.bezierCurveTo(w * 0.15, h * 0.1, w * 0.32, h * 0.16, w * 0.48, h * 0.12);
  horizon.bezierCurveTo(w * 0.68, h * 0.08, w * 0.84, h * 0.18, w, h * 0.09);
  horizon.lineTo(w, 0);
  horizon.lineTo(0, 0);
  horizon.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.fill(horizon);

  const leftRidge = new Path2D();
  leftRidge.moveTo(0, h * 0.28 + parallaxA);
  leftRidge.bezierCurveTo(w * 0.16, h * 0.19 + parallaxA, w * 0.28, h * 0.37 + parallaxA, w * 0.4, h * 0.43 + parallaxA);
  leftRidge.lineTo(w * 0.38, h);
  leftRidge.lineTo(0, h);
  leftRidge.closePath();
  ctx.fillStyle = "rgba(98,119,148,0.22)";
  ctx.fill(leftRidge);

  const rightRidge = new Path2D();
  rightRidge.moveTo(w, h * 0.23 + parallaxB);
  rightRidge.bezierCurveTo(w * 0.85, h * 0.15 + parallaxB, w * 0.74, h * 0.35 + parallaxB, w * 0.57, h * 0.45 + parallaxB);
  rightRidge.lineTo(w * 0.58, h);
  rightRidge.lineTo(w, h);
  rightRidge.closePath();
  ctx.fillStyle = "rgba(42,68,102,0.26)";
  ctx.fill(rightRidge);
}

function drawMapCastShadow(ctx: CanvasRenderingContext2D, area: { x0: number; y0: number; x1: number; y1: number }) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.filter = "blur(24px)";
  const shadowHeight = (area.y1 - area.y0) * 0.12;
  roundRect(ctx, area.x0 + 10, area.y1 - shadowHeight * 0.2, area.x1 - area.x0 - 20, shadowHeight, shadowHeight * 0.45);
  ctx.fill();
  ctx.restore();
}

function drawMapPlane(
  ctx: CanvasRenderingContext2D,
  area: { x0: number; y0: number; x1: number; y1: number },
  cameraProgress: number
) {
  const plane = new Path2D();
  const slope = (1 - cameraProgress) * (area.y1 - area.y0) * 0.2 + (area.y1 - area.y0) * 0.035;
  const rightLift = slope * 0.65;
  plane.moveTo(area.x0, area.y0 + slope);
  plane.lineTo(area.x1, area.y0 + rightLift * 0.15);
  plane.lineTo(area.x1, area.y1 - rightLift * 0.42);
  plane.lineTo(area.x0, area.y1 + slope * 0.24);
  plane.closePath();
  const grad = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  grad.addColorStop(0, "rgba(16,25,32,0.96)");
  grad.addColorStop(0.4, "rgba(13,24,32,0.98)");
  grad.addColorStop(1, "rgba(8,14,22,0.98)");
  ctx.fillStyle = grad;
  ctx.fill(plane);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1.2, (area.x1 - area.x0) * 0.0029);
  ctx.stroke(plane);
  return plane;
}

function drawTerrainRelief(
  ctx: CanvasRenderingContext2D,
  area: { x0: number; y0: number; x1: number; y1: number },
  cameraProgress: number
) {
  const width = area.x1 - area.x0;
  const height = area.y1 - area.y0;
  ctx.save();

  const aurora = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  aurora.addColorStop(0, "rgba(52,211,153,0.08)");
  aurora.addColorStop(0.55, "rgba(56,189,248,0.12)");
  aurora.addColorStop(1, "rgba(192,132,252,0.08)");
  ctx.fillStyle = aurora;
  ctx.fillRect(area.x0, area.y0, width, height);

  for (let i = 0; i < 4; i++) {
    const ridge = new Path2D();
    const y = area.y0 + height * (0.16 + i * 0.16);
    const amp = height * (0.075 - i * 0.01) * (1.06 - cameraProgress * 0.08);
    ridge.moveTo(area.x0 - width * 0.1, area.y1);
    ridge.lineTo(area.x0 - width * 0.08, y + amp * 0.9);
    ridge.bezierCurveTo(
      area.x0 + width * 0.12,
      y - amp * 0.85,
      area.x0 + width * 0.34,
      y + amp * 0.35,
      area.x0 + width * 0.52,
      y - amp * 0.7
    );
    ridge.bezierCurveTo(
      area.x0 + width * 0.7,
      y - amp * 0.1,
      area.x0 + width * 0.86,
      y + amp * 0.78,
      area.x1 + width * 0.08,
      y - amp * 0.28
    );
    ridge.lineTo(area.x1 + width * 0.1, area.y1);
    ridge.closePath();
    ctx.fillStyle = `rgba(${16 + i * 8}, ${30 + i * 10}, ${38 + i * 9}, ${0.34 + i * 0.08})`;
    ctx.fill(ridge);
  }

  ctx.restore();
}

function drawSatelliteMapTexture(
  ctx: CanvasRenderingContext2D,
  area: { x0: number; y0: number; x1: number; y1: number },
  texture: SatelliteRouteTexture,
  view: { center: { x: number; y: number }; rotation: number; zoom: number; pitch: number; bank: number; verticalShift: number }
) {
  const width = area.x1 - area.x0;
  const height = area.y1 - area.y0;
  const baseScale = Math.max(width / texture.width, height / texture.height) * view.zoom;
  const destWidth = texture.width * baseScale;
  const destHeight = texture.height * baseScale;
  const center = { x: (area.x0 + area.x1) / 2, y: (area.y0 + area.y1) / 2 };
  const drawX = center.x - view.center.x * baseScale;
  const drawY = center.y - view.center.y * baseScale + view.verticalShift;
  ctx.save();
  ctx.globalAlpha = 0.98;
  ctx.drawImage(texture.canvas, drawX, drawY, destWidth, destHeight);
  const fog = ctx.createLinearGradient(area.x0, area.y0, area.x0, area.y1);
  fog.addColorStop(0, "rgba(3, 9, 16, 0.08)");
  fog.addColorStop(0.5, "rgba(8, 18, 24, 0.04)");
  fog.addColorStop(1, "rgba(3, 8, 14, 0.12)");
  ctx.fillStyle = fog;
  ctx.fillRect(area.x0, area.y0, width, height);
  ctx.restore();
}

function drawCinematicMapLighting(
  ctx: CanvasRenderingContext2D,
  area: { x0: number; y0: number; x1: number; y1: number },
  view: { progress: number; bank: number }
) {
  const width = area.x1 - area.x0;
  const height = area.y1 - area.y0;
  ctx.save();
  const topSweep = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  topSweep.addColorStop(0, "rgba(255,255,255,0.05)");
  topSweep.addColorStop(0.45, "rgba(255,255,255,0)");
  topSweep.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = topSweep;
  ctx.fillRect(area.x0, area.y0, width, height);

  const beamX = area.x0 + width * (0.58 + view.progress * 0.2);
  const beam = ctx.createLinearGradient(beamX, area.y0, beamX + width * 0.16, area.y1);
  beam.addColorStop(0, "rgba(56,189,248,0.18)");
  beam.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = beam;
  ctx.fillRect(beamX - width * 0.02, area.y0, width * 0.24, height);
  const sunRim = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y0 + height * 0.45);
  sunRim.addColorStop(0, "rgba(255,255,255,0)");
  sunRim.addColorStop(0.5, `rgba(255,255,255,${0.1 + Math.abs(view.bank) * 0.2})`);
  sunRim.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sunRim;
  ctx.fillRect(area.x0, area.y0, width, height * 0.35);
  ctx.restore();
}

function drawSatelliteRouteOverlay(
  ctx: CanvasRenderingContext2D,
  area: { x0: number; y0: number; x1: number; y1: number },
  texture: SatelliteRouteTexture,
  view: { center: { x: number; y: number }; rotation: number; zoom: number; progress: number; pitch: number; bank: number; verticalShift: number },
  routeProgress: number,
  cameraProgress: number,
  focusPoints: RoutePoint[] | null
) {
  const width = area.x1 - area.x0;
  const height = area.y1 - area.y0;
  const baseScale = Math.max(width / texture.width, height / texture.height) * view.zoom;
  const areaCenter = { x: (area.x0 + area.x1) / 2, y: (area.y0 + area.y1) / 2 };
  const offset = {
    x: areaCenter.x - view.center.x * baseScale,
    y: areaCenter.y - view.center.y * baseScale + view.verticalShift,
  };
  const toScreen = (point: { x: number; y: number }) => {
    const p = { x: offset.x + point.x * baseScale, y: offset.y + point.y * baseScale };
    const rotated = rotatePoint(p, areaCenter, view.rotation);
    const dx = rotated.x - areaCenter.x;
    const dy = rotated.y - areaCenter.y;
    return {
      x: areaCenter.x + dx - dy * 0.12,
      y: areaCenter.y + dx * (view.bank * 0.1) + dy * view.pitch,
    };
  };

  const clampedProgress = Math.max(0, Math.min(1, routeProgress));
  const exactIndex = clampedProgress * (texture.projectedPoints.length - 1);
  const lastIndex = Math.floor(exactIndex);
  const drawnPoints = texture.projectedPoints.slice(0, lastIndex + 1);
  if (lastIndex < texture.projectedPoints.length - 1) {
    drawnPoints.push(getPointAtProgress2D(texture.projectedPoints, clampedProgress));
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Thick underlay so the GPX trace remains visible on bright satellite tiles.
  const relief = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  relief.addColorStop(0, "rgba(15, 23, 42, 0.44)");
  relief.addColorStop(0.6, "rgba(30, 41, 59, 0.48)");
  relief.addColorStop(1, "rgba(15, 23, 42, 0.38)");
  ctx.strokeStyle = relief;
  ctx.lineWidth = Math.max(15, width * 0.026);
  ctx.beginPath();
  drawnPoints.forEach((point, index) => {
    const screen = toScreen(point);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = Math.max(8, width * 0.014);
  ctx.beginPath();
  drawnPoints.forEach((point, index) => {
    const screen = toScreen(point);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.stroke();

  const glow = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  glow.addColorStop(0, "rgba(56,189,248,0.45)");
  glow.addColorStop(0.55, "rgba(99,102,241,0.45)");
  glow.addColorStop(1, "rgba(34,197,94,0.3)");
  ctx.strokeStyle = glow;
  ctx.lineWidth = Math.max(5.5, width * 0.011);
  ctx.beginPath();
  drawnPoints.forEach((point, index) => {
    const screen = toScreen(point);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.stroke();

  const core = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  core.addColorStop(0, "#38bdf8");
  core.addColorStop(0.55, "#60a5fa");
  core.addColorStop(1, "#22c55e");
  ctx.strokeStyle = core;
  ctx.lineWidth = Math.max(3, width * 0.006);
  ctx.stroke();

  const premiumTrailLength = Math.max(2, Math.floor(drawnPoints.length * 0.22));
  const tail = drawnPoints.slice(Math.max(0, drawnPoints.length - premiumTrailLength));
  if (tail.length >= 2) {
    const premium = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
    premium.addColorStop(0, "rgba(255,255,255,0.0)");
    premium.addColorStop(0.55, "rgba(255,255,255,0.58)");
    premium.addColorStop(1, "rgba(255,255,255,0.95)");
    ctx.strokeStyle = premium;
    ctx.lineWidth = Math.max(2.2, width * 0.005);
    ctx.setLineDash([Math.max(8, width * 0.012), Math.max(10, width * 0.016)]);
    ctx.lineDashOffset = -view.progress * width * 0.18;
    ctx.beginPath();
    tail.forEach((point, index) => {
      const screen = toScreen(point);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const head = toScreen(drawnPoints[drawnPoints.length - 1]);
  ctx.fillStyle = "rgba(96,165,250,0.26)";
  ctx.beginPath();
  ctx.arc(head.x, head.y, Math.max(10, width * 0.018), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#60a5fa";
  ctx.beginPath();
  ctx.moveTo(head.x, head.y - Math.max(8, width * 0.014));
  ctx.lineTo(head.x + Math.max(7, width * 0.012), head.y + Math.max(7, width * 0.012));
  ctx.lineTo(head.x - Math.max(7, width * 0.012), head.y + Math.max(7, width * 0.012));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = Math.max(1.3, width * 0.0024);
  ctx.beginPath();
  ctx.arc(head.x, head.y, Math.max(12, width * 0.02), 0, Math.PI * 2);
  ctx.stroke();

  const start = toScreen(texture.projectedPoints[0]);
  drawPinIcon(ctx, start.x, start.y, Math.max(18, width * 0.026), "#22c55e");
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `700 ${Math.max(10, Math.round(width * 0.015))}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("START", start.x + Math.max(10, width * 0.014), start.y - Math.max(10, width * 0.012));

  const finish = toScreen(texture.projectedPoints[texture.projectedPoints.length - 1]);
  drawPinIcon(ctx, finish.x, finish.y, Math.max(18, width * 0.026), "#38bdf8");
  ctx.textAlign = "left";
  ctx.fillText("FINISH", finish.x + Math.max(10, width * 0.014), finish.y - Math.max(10, width * 0.012));

  if (focusPoints && texture.projectedFocusPoints.length > 0) {
    const pulse = 0.84;
    texture.projectedFocusPoints.forEach((point, index) => {
      const marker = toScreen(point);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, Math.max(10, width * 0.015) * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = index === 0 ? "rgba(34,197,94,0.95)" : "rgba(56,189,248,0.9)";
      ctx.lineWidth = Math.max(1.6, width * 0.0028);
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, Math.max(6, width * 0.0095), 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawTerrainMesh(
  ctx: CanvasRenderingContext2D,
  area: { x0: number; y0: number; x1: number; y1: number },
  cameraProgress: number
) {
  const width = area.x1 - area.x0;
  const height = area.y1 - area.y0;
  ctx.save();
  ctx.lineCap = "round";

  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const y = area.y0 + height * t;
    const bend = (1 - cameraProgress) * height * 0.08 * (1 - t);
    ctx.strokeStyle = i % 2 === 0 ? "rgba(72, 163, 141, 0.18)" : "rgba(255,255,255,0.06)";
    ctx.lineWidth = Math.max(1, width * 0.0018);
    ctx.beginPath();
    ctx.moveTo(area.x0, y + bend);
    ctx.bezierCurveTo(
      area.x0 + width * 0.28,
      y - bend * 0.7,
      area.x0 + width * 0.64,
      y + bend * 0.5,
      area.x1,
      y - bend * 0.35
    );
    ctx.stroke();
  }

  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = area.x0 + width * t;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = Math.max(1, width * 0.0014);
    ctx.beginPath();
    ctx.moveTo(x, area.y0 + height * 0.02);
    ctx.lineTo(x + (0.5 - t) * width * 0.08, area.y1);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(
    area.x0 + width * 0.56,
    area.y0 + height * 0.34,
    width * 0.02,
    area.x0 + width * 0.56,
    area.y0 + height * 0.34,
    width * 0.56
  );
  glow.addColorStop(0, "rgba(56, 189, 248, 0.14)");
  glow.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(area.x0, area.y0, width, height);
  ctx.restore();
}

function drawRouteChrome(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mapArea: { x0: number; y0: number; x1: number; y1: number }
) {
  drawHudPill(ctx, mapArea.x0 + w * 0.018, mapArea.y0 - h * 0.036, "ROUTE", true, "emerald");
  drawHudPill(ctx, mapArea.x0 + w * 0.165, mapArea.y0 - h * 0.036, "GPX", false, "slate");
  drawHudPill(ctx, mapArea.x1 - w * 0.205, mapArea.y0 - h * 0.036, "TRAVELBOAST-STYLE", false, "cyan");
  drawCompassBadge(ctx, mapArea.x0 - w * 0.018, mapArea.y0 + h * 0.02, Math.max(18, w * 0.03));
}

function drawRouteInfoPanel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  typography: Typography,
  points: RoutePoint[] | null
) {
  const panelX = w * 0.07;
  const panelY = h * 0.63;
  const panelW = w * 0.86;
  const panelH = h * 0.19;
  ctx.save();

  const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrad.addColorStop(0, "rgba(7,10,16,0.22)");
  panelGrad.addColorStop(0.28, "rgba(7,10,16,0.68)");
  panelGrad.addColorStop(1, "rgba(5,7,11,0.92)");
  ctx.fillStyle = panelGrad;
  roundRect(ctx, panelX, panelY, panelW, panelH, w * 0.04);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = Math.max(1, w * 0.0018);
  roundRect(ctx, panelX, panelY, panelW, panelH, w * 0.04);
  ctx.stroke();

  drawHudPill(ctx, panelX + w * 0.018, panelY + h * 0.018, "GPX ROUTE", false, "slate");
  drawHudPill(ctx, panelX + w * 0.245, panelY + h * 0.018, "STATIC MAP", false, "cyan");

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  const titleSize = Math.round(w * 0.064);
  ctx.font = `${typography === "elegant-serif" ? "italic 600" : "700"} ${titleSize}px ${fontStack(typography)}`;
  const titleLines = wrapLines(ctx, title, panelW * 0.62);
  const titleStartY = panelY + h * 0.08;
  titleLines.forEach((line, i) => ctx.fillText(line, panelX + w * 0.03, titleStartY + i * titleSize * 1.16));

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  const subtitleSize = Math.round(w * 0.032);
  ctx.font = `500 ${subtitleSize}px ${fontStack("bold-sans")}`;
  const subtitleLines = wrapLines(ctx, subtitle, panelW * 0.64);
  const subtitleY = titleStartY + titleLines.length * titleSize * 1.16 + subtitleSize * 0.95;
  subtitleLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, panelX + w * 0.03, subtitleY + i * subtitleSize * 1.24));

  const chartX = panelX + panelW * 0.64;
  const chartY = panelY + panelH * 0.2;
  const chartW = panelW * 0.28;
  const chartH = panelH * 0.42;
  drawMiniRouteProfile(ctx, chartX, chartY, chartW, chartH, points);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.moveTo(panelX + panelW * 0.61, panelY + panelH * 0.18);
  ctx.lineTo(panelX + panelW * 0.61, panelY + panelH * 0.82);
  ctx.stroke();

  const chipY = panelY + panelH * 0.76;
  drawHudPill(ctx, panelX + w * 0.03, chipY, "START → FINISH", false, "slate");
  drawHudPill(ctx, panelX + w * 0.215, chipY, "TRACE VISIBLE", true, "cyan");
  drawHudPill(ctx, panelX + w * 0.385, chipY, "NORTH-UP", false, "emerald");

  ctx.restore();
}

/**
 * A transparent, style-typeset hook-text overlay burned onto a freeze-frame
 * (the Viral "stop the scroll" opener). Centered horizontally and kept in an
 * upper-middle "safe" zone to avoid Instagram's bottom caption area/controls.
 */
export async function generateHookOverlayPng(w: number, h: number, opts: { text: string; typography: Typography }): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  const size = Math.round(w * 0.09);
  ctx.font = `900 ${size}px ${fontStack(opts.typography)}`;
  ctx.textAlign = "center";
  const maxWidth = w * 0.84;
  const lines = wrapLines(ctx, opts.text.toUpperCase(), maxWidth);
  const lineHeight = size * 1.15;
  const blockHeight = lines.length * lineHeight;
  const safeCenterY = h * 0.36;
  const startY = safeCenterY - blockHeight / 2 + lineHeight * 0.8;

  // Soft dark backing panel so bold white text stays legible on bright footage.
  const padY = size * 0.5;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, w * 0.06, startY - lineHeight * 0.8 - padY * 0.4, w * 0.88, blockHeight + padY, Math.min(24, h * 0.03));
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.15;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineHeight));

  return canvasToPng(canvas);
}

/**
 * A subtle end-of-reel setup overlay: a compact translucent card over the
 * final frame, listing only the equipment the user explicitly marked as
 * `visibleInReel`. Kept neutral ("Ride Setup") so it feels documentary, not
 * promotional.
 */
export async function generateAdventureSetupOverlayPng(
  w: number,
  h: number,
  opts: { title: string; lines: string[]; typography: Typography }
): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  const panelW = w * 0.8;
  const rowCount = Math.min(4, Math.max(1, opts.lines.length));
  const panelH = Math.max(h * 0.24, 120 + rowCount * h * 0.045);
  const panelX = (w - panelW) / 2;
  const panelY = h * 0.58;

  const glow = ctx.createRadialGradient(w / 2, panelY + panelH * 0.2, 0, w / 2, panelY + panelH * 0.2, panelW * 0.6);
  glow.addColorStop(0, "rgba(244,114,182,0.14)");
  glow.addColorStop(1, "rgba(244,114,182,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, panelY - h * 0.08, w, panelH + h * 0.16);

  ctx.fillStyle = "rgba(7, 10, 18, 0.56)";
  roundRect(ctx, panelX, panelY, panelW, panelH, Math.min(34, w * 0.04));
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.2;
  roundRect(ctx, panelX, panelY, panelW, panelH, Math.min(34, w * 0.04));
  ctx.stroke();

  const labelSize = Math.round(w * 0.026);
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.font = `700 ${labelSize}px ${fontStack("bold-sans")}`;
  ctx.textAlign = "left";
  ctx.fillText(opts.title.toUpperCase(), panelX + panelW * 0.08, panelY + panelH * 0.16);

  const lineSize = Math.round(w * 0.042);
  ctx.font = `600 ${lineSize}px ${fontStack(opts.typography)}`;
  ctx.fillStyle = "#ffffff";
  const startY = panelY + panelH * 0.33;
  const lineHeight = lineSize * 1.22;
  opts.lines.slice(0, 4).forEach((line, index) => {
    const y = startY + index * lineHeight;
    ctx.fillStyle = index === 0 ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.84)";
    ctx.fillText(line, panelX + panelW * 0.08, y);
  });

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = `500 ${Math.round(w * 0.022)}px ${fontStack("bold-sans")}`;
  ctx.fillText("Documented inside the Adventure Report", panelX + panelW * 0.08, panelY + panelH * 0.88);

  return canvasToPng(canvas);
}

/**
 * Dedicated final setup card (opaque background) for the last screen of the
 * Reel so the user has enough time to read it clearly.
 */
export async function generateAdventureSetupEndCardPng(
  w: number,
  h: number,
  opts: { title: string; lines: string[] }
): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  // Match Adventure Card look: premium dark gradient + warm/fuchsia halo.
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#090b14");
  bg.addColorStop(0.55, "#121726");
  bg.addColorStop(1, "#06070d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.18, 0, w * 0.5, h * 0.18, w * 0.58);
  glow.addColorStop(0, "rgba(244,114,182,0.22)");
  glow.addColorStop(0.45, "rgba(249,115,22,0.1)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Small logo
  const logoX = w * 0.12;
  const logoY = h * 0.095;
  const logoR = Math.max(22, w * 0.028);
  const logoGrad = ctx.createLinearGradient(logoX - logoR, logoY - logoR, logoX + logoR, logoY + logoR);
  logoGrad.addColorStop(0, "#e879f9");
  logoGrad.addColorStop(1, "#fb923c");
  ctx.fillStyle = logoGrad;
  ctx.beginPath();
  ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(logoX - logoR * 0.25, logoY - logoR * 0.38);
  ctx.lineTo(logoX - logoR * 0.25, logoY + logoR * 0.38);
  ctx.lineTo(logoX + logoR * 0.45, logoY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.74)";
  ctx.font = `600 ${Math.round(w * 0.028)}px ${fontStack("bold-sans")}`;
  ctx.fillText("ClipsyReel", logoX + logoR * 1.8, logoY + logoR * 0.2);

  const forcedTitle = "My Adventure Gear";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.46)";
  ctx.font = `700 ${Math.round(w * 0.028)}px ${fontStack("bold-sans")}`;
  ctx.fillText("ADVENTURE CARD", w * 0.5, h * 0.155);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `700 ${Math.round(w * 0.078)}px ${fontStack("bold-sans")}`;
  const titleLines = wrapLines(ctx, forcedTitle, w * 0.76);
  titleLines.slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, w * 0.5, h * 0.21 + index * Math.round(w * 0.082));
  });
  ctx.textAlign = "left";

  const panelX = w * 0.1;
  const panelY = h * 0.31;
  const panelW = w * 0.8;
  const panelH = h * 0.52;
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  roundRect(ctx, panelX, panelY, panelW, panelH, Math.min(38, w * 0.06));
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.2;
  roundRect(ctx, panelX, panelY, panelW, panelH, Math.min(38, w * 0.06));
  ctx.stroke();

  const lineSize = Math.round(w * 0.045);
  const lineHeight = lineSize * 1.28;
  ctx.font = `600 ${lineSize}px ${fontStack("bold-sans")}`;
  opts.lines.slice(0, 5).forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.86)";
    ctx.fillText(line, panelX + panelW * 0.08, panelY + panelH * 0.2 + index * lineHeight);
  });

  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = `500 ${Math.round(w * 0.02)}px ${fontStack("bold-sans")}`;
  ctx.fillText("Created with ClipsyReel", w * 0.12, h * 0.95);

  return canvasToPng(canvas);
}

export async function generateAdventureCardPng(
  w: number,
  h: number,
  opts: {
    routeTitle: string;
    region: string | null;
    setupLines: string[];
    statLines: string[];
  }
): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#090b14");
  bg.addColorStop(0.55, "#121726");
  bg.addColorStop(1, "#06070d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const halo = ctx.createRadialGradient(w * 0.5, h * 0.18, 0, w * 0.5, h * 0.18, w * 0.58);
  halo.addColorStop(0, "rgba(244,114,182,0.22)");
  halo.addColorStop(0.45, "rgba(249,115,22,0.1)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = Math.max(2, w * 0.0032);
  roundRect(ctx, w * 0.04, h * 0.03, w * 0.92, h * 0.94, Math.min(52, w * 0.08));
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = `700 ${Math.round(w * 0.03)}px ${fontStack("bold-sans")}`;
  ctx.textAlign = "left";
  ctx.fillText("ADVENTURE CARD", w * 0.1, h * 0.1);

  ctx.fillStyle = "#ffffff";
  const titleSize = Math.round(w * 0.092);
  ctx.font = `700 ${titleSize}px ${fontStack("bold-sans")}`;
  const titleLines = wrapLines(ctx, opts.routeTitle, w * 0.76);
  titleLines.slice(0, 3).forEach((line, index) => {
    ctx.fillText(line, w * 0.1, h * 0.18 + index * titleSize * 1.14);
  });

  if (opts.region) {
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = `500 ${Math.round(w * 0.042)}px ${fontStack("bold-sans")}`;
    ctx.fillText(opts.region, w * 0.1, h * 0.18 + titleLines.length * titleSize * 1.14 + h * 0.04);
  }

  const panelX = w * 0.08;
  const panelY = h * 0.54;
  const panelW = w * 0.84;
  const panelH = h * 0.34;
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  roundRect(ctx, panelX, panelY, panelW, panelH, Math.min(40, w * 0.07));
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, panelX, panelY, panelW, panelH, Math.min(40, w * 0.07));
  ctx.stroke();

  const setupSize = Math.round(w * 0.048);
  ctx.font = `600 ${setupSize}px ${fontStack("bold-sans")}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  opts.setupLines.slice(0, 5).forEach((line, index) => {
    ctx.fillText(line, panelX + panelW * 0.08, panelY + panelH * 0.18 + index * setupSize * 1.34);
  });

  const statY = panelY + panelH * 0.7;
  const statW = (panelW - panelW * 0.12) / Math.max(1, Math.min(3, opts.statLines.length));
  opts.statLines.slice(0, 3).forEach((line, index) => {
    const chipX = panelX + panelW * 0.06 + index * statW;
    const chipW = statW - panelW * 0.03;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, chipX, statY, chipW, h * 0.07, Math.min(26, w * 0.05));
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, chipX, statY, chipW, h * 0.07, Math.min(26, w * 0.05));
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `600 ${Math.round(w * 0.032)}px ${fontStack("bold-sans")}`;
    ctx.fillText(line, chipX + w * 0.03, statY + h * 0.044);
  });

  return canvasToPng(canvas);
}

/** Plots real GPX `points` fitted-to-bounds inside `area`, preserving aspect ratio (so the shape isn't stretched/distorted), with soft glow + start/end markers. */
function drawRoutePolyline(
  ctx: CanvasRenderingContext2D,
  points: RoutePoint[],
  area: { x0: number; y0: number; x1: number; y1: number },
  progress: number = 1,
  cinematicSatelliteMode: boolean = false
) {
  const { areaW, toXY } = createRouteProjector(points, area);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Only draw the fraction of the route corresponding to `progress` (used
  // for the animated route-reveal clip — see `generateRouteAnimationFrames`).
  // Interpolates the exact cut point between two source samples so the line
  // grows smoothly frame-to-frame instead of jumping point-to-point.
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const exactIndex = clampedProgress * (points.length - 1);
  const lastIndex = Math.floor(exactIndex);
  const drawnPoints = points.slice(0, lastIndex + 1);
  if (lastIndex < points.length - 1) {
    const a = points[lastIndex];
    const b = points[lastIndex + 1];
    const t = exactIndex - lastIndex;
    drawnPoints.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }

  // Soft shadow, then glow, then crisp core line so the route reads like a flyover path on terrain.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.34)";
  ctx.lineWidth = Math.max(6, areaW * 0.017);
  ctx.beginPath();
  drawnPoints.forEach((p, i) => {
    const { x, y } = toXY(p);
    if (i === 0) ctx.moveTo(x + areaW * 0.003, y + areaW * 0.004);
    else ctx.lineTo(x + areaW * 0.003, y + areaW * 0.004);
  });
  ctx.stroke();

  const glowGradient = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  if (cinematicSatelliteMode) {
    glowGradient.addColorStop(0, "rgba(239, 68, 68, 0.22)");
    glowGradient.addColorStop(0.55, "rgba(248, 113, 113, 0.3)");
    glowGradient.addColorStop(1, "rgba(255, 165, 0, 0.16)");
  } else {
    glowGradient.addColorStop(0, "rgba(52, 211, 153, 0.28)");
    glowGradient.addColorStop(0.55, "rgba(56, 189, 248, 0.34)");
    glowGradient.addColorStop(1, "rgba(192, 132, 252, 0.22)");
  }
  ctx.strokeStyle = glowGradient;
  ctx.lineWidth = Math.max(4, areaW * 0.012);
  ctx.beginPath();
  drawnPoints.forEach((p, i) => {
    const { x, y } = toXY(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const coreGradient = ctx.createLinearGradient(area.x0, area.y0, area.x1, area.y1);
  if (cinematicSatelliteMode) {
    coreGradient.addColorStop(0, "#ef4444");
    coreGradient.addColorStop(0.45, "#dc2626");
    coreGradient.addColorStop(1, "#f97316");
  } else {
    coreGradient.addColorStop(0, "#34d399");
    coreGradient.addColorStop(0.6, "#38bdf8");
    coreGradient.addColorStop(1, "#c084fc");
  }
  ctx.strokeStyle = coreGradient;
  ctx.lineWidth = Math.max(1.5, areaW * 0.004);
  ctx.stroke();

  drawnPoints.forEach((point, i) => {
    if (i === 0 || i === drawnPoints.length - 1 || i % Math.max(4, Math.floor(drawnPoints.length / 5)) === 0) {
      const { x, y } = toXY(point);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2, areaW * 0.0026), 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const start = toXY(points[0]);
  ctx.fillStyle = cinematicSatelliteMode ? "#60a5fa" : "#34d399";
  ctx.beginPath();
  ctx.arc(start.x, start.y, Math.max(3, areaW * 0.009), 0, Math.PI * 2);
  ctx.fill();

  if (clampedProgress >= 1) {
    // Fully drawn — show the fixed end-of-route marker.
    const end = toXY(points[points.length - 1]);
    ctx.fillStyle = cinematicSatelliteMode ? "#60a5fa" : "#38bdf8";
    ctx.beginPath();
    ctx.arc(end.x, end.y, Math.max(3, areaW * 0.009), 0, Math.PI * 2);
    ctx.fill();
  } else if (drawnPoints.length > 0) {
    // Still drawing — a small pulsing "traveling" head dot at the current tip, like a live position marker.
    const head = toXY(drawnPoints[drawnPoints.length - 1]);
    ctx.fillStyle = cinematicSatelliteMode ? "rgba(96, 165, 250, 0.35)" : "rgba(56, 189, 248, 0.35)";
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(6, areaW * 0.016), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cinematicSatelliteMode ? "#60a5fa" : "#38bdf8";
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(3, areaW * 0.009), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHudPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  active: boolean,
  tone: "slate" | "cyan" | "emerald"
) {
  ctx.save();
  const fontSize = 12;
  ctx.font = `700 ${fontSize}px ${fontStack("bold-sans")}`;
  const padX = 14;
  const pillH = 28;
  const pillW = ctx.measureText(label).width + padX * 2;
  const tones = {
    slate: {
      fill: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
      stroke: "rgba(255,255,255,0.1)",
      text: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.72)",
    },
    cyan: {
      fill: active ? "rgba(34,211,238,0.2)" : "rgba(34,211,238,0.1)",
      stroke: "rgba(34,211,238,0.18)",
      text: active ? "rgba(207,250,254,0.98)" : "rgba(186,230,253,0.88)",
    },
    emerald: {
      fill: active ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.1)",
      stroke: "rgba(16,185,129,0.18)",
      text: active ? "rgba(220,252,231,0.98)" : "rgba(187,247,208,0.9)",
    },
  }[tone];
  ctx.fillStyle = tones.fill;
  roundRect(ctx, x, y, pillW, pillH, 14);
  ctx.fill();
  ctx.strokeStyle = tones.stroke;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, pillW, pillH, 14);
  ctx.stroke();
  ctx.fillStyle = tones.text;
  ctx.textAlign = "left";
  ctx.fillText(label, x + padX, y + 18);
  ctx.restore();
}

function drawCompassBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  grad.addColorStop(0, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `700 ${Math.round(radius * 0.85)}px ${fontStack("bold-sans")}`;
  ctx.textAlign = "center";
  ctx.fillText("N", cx, cy + radius * 0.3);
  ctx.restore();
}

function drawMiniRouteProfile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  points: RoutePoint[] | null
) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 18);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 18);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.font = `700 11px ${fontStack("bold-sans")}`;
  ctx.textAlign = "left";
  ctx.fillText("ROUTE PROFILE", x + 12, y + 18);

  const samples = points && points.length >= 2 ? points : null;
  const coords =
    samples?.map((point, index) => {
      const prev = samples[Math.max(0, index - 1)];
      const next = samples[Math.min(samples.length - 1, index + 1)];
      const curvature = Math.abs(next.lng - prev.lng) + Math.abs(next.lat - prev.lat);
      return {
        x: x + 12 + (index / Math.max(1, samples.length - 1)) * (width - 24),
        y: y + height - 14 - ((0.25 + curvature * 1800 + Math.sin(index * 0.7) * 0.08) * (height - 36)),
      };
    }) ??
    Array.from({ length: 14 }, (_, index) => ({
      x: x + 12 + (index / 13) * (width - 24),
      y: y + height - 16 - (Math.sin(index * 0.65) * 0.16 + 0.34 + (index / 13) * 0.12) * (height - 38),
    }));

  for (let i = 1; i <= 3; i++) {
    const gy = y + 12 + (i / 4) * (height - 24);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(x + 10, gy);
    ctx.lineTo(x + width - 10, gy);
    ctx.stroke();
  }

  const area = new Path2D();
  area.moveTo(coords[0].x, y + height - 12);
  coords.forEach((point, index) => {
    if (index === 0) area.lineTo(point.x, point.y);
    else area.lineTo(point.x, point.y);
  });
  area.lineTo(coords[coords.length - 1].x, y + height - 12);
  area.closePath();
  const fill = ctx.createLinearGradient(0, y, 0, y + height);
  fill.addColorStop(0, "rgba(56,189,248,0.22)");
  fill.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = fill;
  ctx.fill(area);

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  coords.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  const line = ctx.createLinearGradient(x, y, x + width, y);
  line.addColorStop(0, "#34d399");
  line.addColorStop(0.6, "#38bdf8");
  line.addColorStop(1, "#c084fc");
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  coords.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  const last = coords[coords.length - 1];
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFocusMarkers(
  ctx: CanvasRenderingContext2D,
  points: RoutePoint[],
  focusPoints: RoutePoint[] | null,
  area: { x0: number; y0: number; x1: number; y1: number },
  cameraProgress: number
) {
  if (!focusPoints || focusPoints.length === 0) return;
  const { areaW, toXY } = createRouteProjector(points, area);
  const pulse = 0.72 + cameraProgress * 0.36;
  focusPoints.forEach((point, index) => {
    const projected = toXY(point);
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "rgba(248, 250, 252, 0.14)";
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, Math.max(10, areaW * 0.022) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = index === 0 ? "rgba(249,115,22,0.88)" : "rgba(56,189,248,0.82)";
    ctx.lineWidth = Math.max(1.8, areaW * 0.0032);
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, Math.max(7, areaW * 0.013), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, Math.max(2.4, areaW * 0.0044), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

/**
 * A compact location-pin icon, canvas-drawn (no external icon asset needed).
 */
function drawPinIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.15, size * 0.42, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.arc(cx, cy - size * 0.15, size * 0.42, Math.PI * 0.85, Math.PI * 0.15, false);
  ctx.moveTo(cx - size * 0.34, cy + size * 0.05);
  ctx.quadraticCurveTo(cx, cy + size * 0.55, cx + size * 0.34, cy + size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.15, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A real-world-context title card: where + when (and, if available, what
 * the weather was that day) — drawn from actual GPS/timestamp metadata read
 * out of the uploaded video file plus a live weather lookup (see
 * `video-metadata.ts` / `weather.ts`). Only ever rendered when at least one
 * real value was found; never shown with placeholder/guessed content.
 */
/**
 * A premium, opaque full-frame opening title card — the user's own custom
 * Reel title (e.g. "Alps 2026", "Our Road Trip"), centered, in the style's
 * typography. This is a Pro-only, optional addition on top of the existing
 * hook-text overlay (which is burned onto the *opener clip while it plays*);
 * the title card instead plays as its own short beat *before* any footage,
 * like a real film's title screen. Built as a standalone still clip (see
 * `buildStillClip`'s `animateOverlay` option in `video-engine.ts`) so the
 * text gets a real animated fade + rise entrance in the exported MP4, not
 * just a static pop-in.
 */
export async function generateTitleCardBackgroundPng(w: number, h: number): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0b0b12");
  bg.addColorStop(0.55, "#141420");
  bg.addColorStop(1, "#0b0b12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Soft vignette so the centered title reads as a deliberate title card, not a flat slide.
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.65);
  vignette.addColorStop(0, "rgba(255,255,255,0.05)");
  vignette.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  return canvasToPng(canvas);
}

/** The centered title text itself, drawn transparent so it can be composited (and animated in) over `generateTitleCardBackgroundPng`. */
export async function generateTitleCardTextPng(w: number, h: number, opts: { title: string; typography: Typography }): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  ctx.textAlign = "center";
  const size = Math.round(w * 0.1);
  ctx.font = `700 ${size}px ${fontStack(opts.typography)}`;
  const maxWidth = w * 0.82;
  const lines = wrapLines(ctx, opts.title, maxWidth);
  const lineHeight = size * 1.2;
  const blockHeight = lines.length * lineHeight;
  const startY = h / 2 - blockHeight / 2 + lineHeight * 0.8;

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = size * 0.2;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineHeight));

  // A thin centered rule under the title — small premium "title card" touch.
  ctx.shadowBlur = 0;
  const ruleY = startY + blockHeight + lineHeight * 0.15;
  const ruleW = Math.min(maxWidth * 0.28, w * 0.24);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, w * 0.0025);
  ctx.beginPath();
  ctx.moveTo(w / 2 - ruleW / 2, ruleY);
  ctx.lineTo(w / 2 + ruleW / 2, ruleY);
  ctx.stroke();

  return canvasToPng(canvas);
}

export async function generateMetadataCardPng(
  w: number,
  h: number,
  opts: { lines: string[]; typography: Typography }
): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#111827");
  bg.addColorStop(1, "#0a0a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  drawPinIcon(ctx, w / 2, h * 0.36, w * 0.09, "rgba(56, 189, 248, 0.9)");

  ctx.textAlign = "center";
  const lineSize = Math.round(w * 0.052);
  ctx.font = `600 ${lineSize}px ${fontStack(opts.typography)}`;
  opts.lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)";
    if (i === 0) ctx.font = `700 ${lineSize}px ${fontStack(opts.typography)}`;
    else ctx.font = `500 ${Math.round(lineSize * 0.72)}px ${fontStack("bold-sans")}`;
    ctx.fillText(line, w / 2, h * 0.56 + i * lineSize * 1.35);
  });

  return canvasToPng(canvas);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * A transparent "polaroid" border + soft drop shadow to wrap around a
 * frozen frame (Travel/Adventure "memory" ending). The frozen video frame
 * itself shows through the transparent center; only the white photo-card
 * border, subtle rotation, and shadow are drawn here.
 */
export async function generatePolaroidOverlayPng(w: number, h: number): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  const margin = w * 0.055;
  const bottomMargin = h * 0.1;
  const angle = -2.2 * (Math.PI / 180);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  ctx.translate(-w / 2, -h / 2);

  // Soft shadow behind the card so it lifts off the frozen frame beneath it.
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = w * 0.05;
  ctx.shadowOffsetY = h * 0.015;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.fillRect(-margin * 0.3, -margin * 0.3, w + margin * 0.6, h + margin * 0.6);

  // Punch a transparent "photo window" back out so the frame underneath shows through.
  ctx.shadowColor = "transparent";
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(margin, margin, w - margin * 2, h - margin * 2 - bottomMargin + margin);
  ctx.restore();

  return canvasToPng(canvas);
}

/**
 * A soft, warm radial glow anchored to a top corner — cheap stand-in for a
 * real light-leak film artifact (Travel/Adventure/Cinematic). Screen-blended
 * on top of the graded footage via ffmpeg's `blend=all_mode=screen`.
 */
export async function generateLightLeakPng(w: number, h: number): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.85;
  const cy = h * 0.08;
  const r = w * 0.9;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, "rgba(255, 189, 110, 0.55)");
  grad.addColorStop(0.35, "rgba(255, 140, 90, 0.28)");
  grad.addColorStop(0.7, "rgba(255, 90, 120, 0.08)");
  grad.addColorStop(1, "rgba(255, 90, 120, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  return canvasToPng(canvas);
}

/**
 * Sport-style corner HUD graphic: bracket corner marks + a "REC ●" indicator
 * + a small technical-mono label. Static (not real telemetry), but real
 * burned-in pixels giving the Reel an action-camera feel throughout.
 */
export async function generateHudOverlayPng(w: number, h: number): Promise<Uint8Array> {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  const margin = w * 0.055;
  const armLen = w * 0.06;
  ctx.strokeStyle = "rgba(163, 230, 53, 0.85)";
  ctx.lineWidth = Math.max(2, w * 0.006);
  ctx.lineCap = "round";

  const corners: [number, number, number, number][] = [
    [margin, margin, 1, 1],
    [w - margin, margin, -1, 1],
    [margin, h - margin, 1, -1],
    [w - margin, h - margin, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + armLen * dy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + armLen * dx, y);
    ctx.stroke();
  }

  // "REC ●" indicator, top-left.
  const recSize = Math.round(w * 0.032);
  ctx.font = `700 ${recSize}px 'Courier New', ui-monospace, monospace`;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("REC", margin + armLen * 0.25, margin + armLen + recSize);
  ctx.fillStyle = "#f87171";
  ctx.beginPath();
  ctx.arc(margin + armLen * 0.25 + recSize * 1.9, margin + armLen + recSize - recSize * 0.32, recSize * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Small technical label, bottom-right.
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `700 ${Math.round(w * 0.028)}px 'Courier New', ui-monospace, monospace`;
  ctx.fillText("SPORT MODE", w - margin - armLen * 0.25, h - margin - armLen * 0.4);

  return canvasToPng(canvas);
}
