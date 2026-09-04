import { buildGearSummaryEntries, GEAR_LABELS, GearCategoryKey, GearItemSelection, GearSelections } from "@/data/gearCatalog";

export interface GearSummaryClip {
  file: File;
  url: string;
  durationSeconds: number;
}

type AdventureCardSlot = {
  keys: GearCategoryKey[];
  label: string;
  column: 0 | 1;
  row: number;
  colSpan?: 1 | 2;
};

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;
const CLIP_DURATION_SECONDS = 4;
const CARD_LAYOUT: AdventureCardSlot[] = [
  { keys: ["motorcycle"], label: "Moto", column: 0, row: 0 },
  { keys: ["tires"], label: "Pneu", column: 1, row: 0 },
  { keys: ["jacket", "pants"], label: "Veste / Pantalon", column: 0, row: 1, colSpan: 2 },
  { keys: ["helmet", "luggage"], label: "Casque / Bagages", column: 0, row: 2, colSpan: 2 },
  { keys: ["camera", "drone"], label: "Camera / Drone", column: 0, row: 3, colSpan: 2 },
  { keys: ["navigation"], label: "Navigation", column: 0, row: 4, colSpan: 2 },
];

function readBlobDuration(blob: Blob, fallbackSeconds: number) {
  return new Promise<number>((resolve) => {
    const probeUrl = URL.createObjectURL(blob);
    const video = document.createElement("video");
    const finalize = (value: number) => {
      URL.revokeObjectURL(probeUrl);
      resolve(Number.isFinite(value) && value > 0 ? value : fallbackSeconds);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => finalize(video.duration);
    video.onerror = () => finalize(fallbackSeconds);
    video.src = probeUrl;
  });
}

function pickMimeType() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function resolveSelectionLines(selection: GearItemSelection) {
  const brand = selection.brand.trim();
  const model = (selection.customModel.trim() || selection.model.trim()).trim();
  return {
    brand: brand || "—",
    model,
  };
}

function fillTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);

  const visibleLines = lines.slice(0, maxLines);
  visibleLines.forEach((line, index) => {
    const isLastLine = index === visibleLines.length - 1;
    const hasOverflow = lines.length > maxLines && isLastLine;
    const rendered = hasOverflow ? `${line.replace(/[.,;:!?-]*$/, "")}…` : line;
    ctx.fillText(rendered, x, y + index * lineHeight, maxWidth);
  });
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Portrait image failed to load"));
      });
    }
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const naturalWidth = (image as HTMLImageElement).naturalWidth || (image as ImageBitmap).width || w;
  const naturalHeight = (image as HTMLImageElement).naturalHeight || (image as ImageBitmap).height || h;
  const scale = Math.max(w / naturalWidth, h / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  const drawX = x + (w - drawWidth) / 2;
  const drawY = y + (h - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawSelectedEntry(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  roundRectPath(ctx, x, y, w, h, 18);
  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, "rgba(30, 41, 59, 0.6)");
  fill.addColorStop(1, "rgba(15, 23, 42, 0.8)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Premium label
  ctx.fillStyle = "rgba(255, 200, 70, 0.85)";
  ctx.font = "800 11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 16, y + 20);

  // Premium value
  ctx.fillStyle = "rgba(248,250,252,0.95)";
  ctx.font = "700 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  fillTextBlock(ctx, value, x + 16, y + 44, w - 32, 20, 2);
}

function drawSingleSelection(
  ctx: CanvasRenderingContext2D,
  selection: GearItemSelection,
  x: number,
  y: number,
  w: number
) {
  const { brand, model } = resolveSelectionLines(selection);
  ctx.fillStyle = brand === "—" ? "rgba(248,250,252,0.4)" : "rgba(248,250,252,0.98)";
  ctx.font = "800 27px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  fillTextBlock(ctx, brand, x, y, w, 28, 1);

  ctx.fillStyle = model ? "rgba(226,232,240,0.82)" : "rgba(226,232,240,0.28)";
  ctx.font = "600 19px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  fillTextBlock(ctx, model || "Model not set", x, y + 30, w, 22, 2);
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: AdventureCardSlot,
  selections: GearSelections,
  x: number,
  y: number,
  w: number,
  h: number
) {
  roundRectPath(ctx, x, y, w, h, 26);
  const tileFill = ctx.createLinearGradient(x, y, x + w, y + h);
  tileFill.addColorStop(0, "#171b2b");
  tileFill.addColorStop(1, "#111624");
  ctx.fillStyle = tileFill;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "800 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const pillW = Math.max(slot.colSpan === 2 ? 164 : 112, ctx.measureText(slot.label).width + 32);
  roundRectPath(ctx, x + 18, y + 14, pillW, 34, 17);
  const pillFill = ctx.createLinearGradient(x + 18, y + 14, x + 18 + pillW, y + 48);
  pillFill.addColorStop(0, "#f6b519");
  pillFill.addColorStop(1, "#f7ce46");
  ctx.fillStyle = pillFill;
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.fillText(slot.label, x + 34, y + 36);

  if (slot.keys.length === 1) {
    drawSingleSelection(ctx, selections[slot.keys[0]], x + 24, y + 82, w - 48);
    return;
  }

  const innerGap = 22;
  const innerWidth = (w - 48 - innerGap) / 2;
  slot.keys.forEach((key, index) => {
    const offsetX = x + 24 + index * (innerWidth + innerGap);
    const selection = selections[key];
    ctx.fillStyle = "rgba(248,250,252,0.42)";
    ctx.font = "700 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText(GEAR_LABELS[key], offsetX, y + 82);
    drawSingleSelection(ctx, selection, offsetX, y + 110, innerWidth);
  });
}

function drawFrame(ctx: CanvasRenderingContext2D, selections: GearSelections, portraitImage: HTMLImageElement | null) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#090d16");
  background.addColorStop(0.5, "#12182a");
  background.addColorStop(1, "#1b1521");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const cardX = 38;
  const cardY = 40;
  const cardW = width - cardX * 2;
  const cardH = height - cardY * 2;

  roundRectPath(ctx, cardX, cardY, cardW, cardH, 40);
  const cardFill = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardFill.addColorStop(0, "#12182a");
  cardFill.addColorStop(1, "#0a0f1c");
  ctx.fillStyle = cardFill;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (portraitImage) {
    const heroX = cardX + 24;
    const heroY = cardY + 24;
    const heroW = cardW - 48;
    const heroH = 520;
    roundRectPath(ctx, heroX, heroY, heroW, heroH, 34);
    ctx.save();
    ctx.clip();
    drawImageCover(ctx, portraitImage, heroX, heroY, heroW, heroH);
    const overlay = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroH);
    overlay.addColorStop(0, "rgba(3, 7, 18, 0)");
    overlay.addColorStop(0.4, "rgba(3, 7, 18, 0.2)");
    overlay.addColorStop(0.75, "rgba(3, 7, 18, 0.5)");
    overlay.addColorStop(1, "rgba(3, 7, 18, 0.88)");
    ctx.fillStyle = overlay;
    ctx.fillRect(heroX, heroY, heroW, heroH);
    ctx.restore();

    // Premium badge
    const badgeW = 186;
    const badgeH = 40;
    roundRectPath(ctx, heroX + 28, heroY + 32, badgeW, badgeH, 20);
    ctx.fillStyle = "rgba(255, 196, 64, 0.92)";
    ctx.fill();
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#0a0f1c";
    ctx.font = "900 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚡ MOTO + GEAR", heroX + 28 + badgeW / 2, heroY + 52);
    ctx.textAlign = "left";

    // Premium title
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "900 52px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText("My Bike & Kit", heroX + 28, heroY + heroH - 86);
    
    // Premium subtitle
    ctx.fillStyle = "rgba(226,232,240,0.88)";
    ctx.font = "500 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText("Moto + équipement sélectionné", heroX + 28, heroY + heroH - 54);

    const entries = buildGearSummaryEntries(selections);
    const listX = heroX;
    const listY = heroY + heroH + 28;
    const listW = heroW;
    const columnGap = 18;
    const rowGap = 16;
    const itemW = (listW - columnGap) / 2;
    const itemH = 108;
    const rows = Math.max(1, Math.ceil(entries.length / 2));

    // Premium equipment section container
    const containerH = rows * itemH + Math.max(0, rows - 1) * rowGap + 32;
    roundRectPath(ctx, listX, listY, listW, containerH, 28);
    const containerGradient = ctx.createLinearGradient(listX, listY, listX, listY + containerH);
    containerGradient.addColorStop(0, "rgba(255,255,255,0.04)");
    containerGradient.addColorStop(1, "rgba(255,255,255,0.01)");
    ctx.fillStyle = containerGradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Equipment title
    ctx.fillStyle = "rgba(248,250,252,0.92)";
    ctx.font = "700 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText("ÉQUIPEMENT SÉLECTIONNÉ", listX + 18, listY + 24);

    if (entries.length === 0) {
      ctx.fillStyle = "rgba(248,250,252,0.62)";
      ctx.font = "600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillText("Aucun équipement sélectionné", listX + 28, listY + 54);
    } else {
      entries.forEach((entry, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = listX + 12 + col * (itemW + columnGap);
        const y = listY + 42 + row * (itemH + rowGap);
        drawSelectedEntry(ctx, entry.label, entry.value, x, y, itemW, itemH);
      });
    }
    return;
  }

  const headerY = cardY + 4;
  ctx.fillStyle = "rgba(248,250,252,0.98)";
  ctx.font = "800 52px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText("My Adventure setup", cardX + 34, headerY + 38);

  const gridX = cardX + 24;
  const gridY = cardY + 116;
  const gridW = cardW - 48;
  const columnGap = 18;
  const rowGap = 18;
  const columnWidth = (gridW - columnGap) / 2;
  const rowHeights = [145, 176, 176, 176, 112];

  CARD_LAYOUT.forEach((slot) => {
    const x = gridX + slot.column * (columnWidth + columnGap);
    const y = gridY + rowHeights.slice(0, slot.row).reduce((sum, value) => sum + value, 0) + rowGap * slot.row;
    const w = slot.colSpan === 2 ? gridW : columnWidth;
    const h = rowHeights[slot.row];
    drawSlot(ctx, slot, selections, x, y, w, h);
  });
}

function hasAnySelection(selections: GearSelections, portrait: File | null) {
  if (portrait) return true;
  return Object.values(selections).some((selection) => selection.brand.trim() || selection.model.trim() || selection.customModel.trim());
}

export async function generateGearSummaryClip({
  selections,
  portrait,
}: {
  selections: GearSelections;
  portrait?: File | null;
}): Promise<GearSummaryClip | null> {
  if (!hasAnySelection(selections, portrait ?? null)) return Promise.resolve(null);
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Gear summary rendering requires a browser environment."));
  }

  const mimeType = pickMimeType();
  if (!mimeType) {
    return Promise.reject(new Error("Video export is not supported for the gear summary on this browser."));
  }

  return new Promise<GearSummaryClip>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("2D canvas rendering is unavailable for the gear summary."));
      return;
    }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    let animationFrame = 0;
    const startedAt = performance.now();
    let portraitImage: HTMLImageElement | null = null;

    const stop = () => {
      stream.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(animationFrame);
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stop();
      reject(new Error("The gear summary clip could not be recorded."));
    };
    recorder.onstop = () => {
      stop();
      const blob = new Blob(chunks, { type: mimeType });
      void readBlobDuration(blob, CLIP_DURATION_SECONDS).then((durationSeconds) => {
        const url = URL.createObjectURL(blob);
        const file = new File([blob], "gear-summary.webm", { type: mimeType });
        resolve({ file, url, durationSeconds });
      });
    };

    void (async () => {
      if (portrait) {
        portraitImage = await loadImageFromFile(portrait);
      }
      drawFrame(context, selections, portraitImage);
      recorder.start();
      animationFrame = requestAnimationFrame(function tick(now: number) {
        drawFrame(context, selections, portraitImage);
        if ((now - startedAt) / 1000 < CLIP_DURATION_SECONDS) {
          animationFrame = requestAnimationFrame(tick);
          return;
        }
        if (recorder.state !== "inactive") recorder.stop();
      });
    })().catch((error) => {
      stop();
      reject(error instanceof Error ? error : new Error("The gear summary portrait could not be loaded."));
    });
  });
}
