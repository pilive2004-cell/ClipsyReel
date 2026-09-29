import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { tmpdir, availableParallelism } from "os";
import { resolve, join } from "path";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import type {
  RemotionOverlayWindow,
  RemotionTitleWindow,
  ViralRemotionCompositionProps,
  ViralRemotionRenderProps,
  ViralRemotionTitleStyle,
  ViralRemotionTransitionMarker,
} from "@/modules/remotion/render-contract";
import {
  VIRAL_REMOTION_COMPOSITION_ID,
  VIRAL_REMOTION_HEIGHT,
  VIRAL_REMOTION_WIDTH,
} from "@/modules/remotion/render-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REMOTION_ENTRY = resolve(process.cwd(), "src", "modules", "remotion", "server", "Root.tsx");
const REMOTION_BUNDLE_DIR = resolve(process.cwd(), ".remotion-bundles", "viral-export");
const REMOTION_PUBLIC_TEMP_DIR = resolve(process.cwd(), "public", "remotion-temp");
const REMOTION_ASSET_BASE_URL = process.env.REMOTION_ASSET_BASE_URL?.trim() || "http://127.0.0.1:3000";
const CHROME_EXECUTABLE =
  process.env.REMOTION_BROWSER_EXECUTABLE?.trim() ||
  (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : null);
const REMOTION_RENDER_CONCURRENCY = Math.max(1, Math.min(6, availableParallelism()));

let remotionBundlePromise: Promise<string> | null = null;
type RendererModule = typeof import("@remotion/renderer");
const runtimeImport = <T>(specifier: string) =>
  new Function("modulePath", "return import(modulePath)")(
    specifier
  ) as Promise<T>;

class InvalidRenderRequestError extends Error {}

const parseJsonField = <T>(value: FormDataEntryValue | null, fieldName: string): T => {
  if (typeof value !== "string") {
    throw new InvalidRenderRequestError(`Missing or invalid ${fieldName}.`);
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new InvalidRenderRequestError(
      `Failed to parse ${fieldName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const parseOptionalString = (value: FormDataEntryValue | null) => {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseDurationSeconds = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    throw new InvalidRenderRequestError("Missing durationSeconds.");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidRenderRequestError("durationSeconds must be a positive number.");
  }
  return parsed;
};

const parseDimension = (
  value: FormDataEntryValue | null,
  fallback: number,
  fieldName: "width" | "height"
) => {
  if (value === null) {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new InvalidRenderRequestError(`Missing or invalid ${fieldName}.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidRenderRequestError(`${fieldName} must be a positive number.`);
  }
  return Math.max(1, Math.round(parsed));
};

async function getRemotionServeUrl(): Promise<string> {
  if (remotionBundlePromise) {
    return remotionBundlePromise;
  }

  remotionBundlePromise = (async () => {
    const bundlerModuleName = "@remotion/bundler";
    const { bundle } = await runtimeImport<typeof import("@remotion/bundler")>(bundlerModuleName);
    await mkdir(REMOTION_BUNDLE_DIR, { recursive: true });
    return bundle({
      entryPoint: REMOTION_ENTRY,
      outDir: REMOTION_BUNDLE_DIR,
      enableCaching: true,
      onProgress: () => undefined,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias ?? {}),
            "@": resolve(process.cwd(), "src"),
          },
        },
      }),
    });
  })();

  try {
    return await remotionBundlePromise;
  } catch (error) {
    remotionBundlePromise = null;
    throw error;
  }
}

async function renderViralRemotionVideo(video: File, outputPath: string, props: ViralRemotionRenderProps) {
  const requestId = randomUUID();
  const publicFileName = `viral-base-${requestId}.mp4`;
  const publicFilePath = resolve(REMOTION_PUBLIC_TEMP_DIR, publicFileName);
  const publicVideoPath = `remotion-temp/${publicFileName}`;
  const outputWidth = Math.max(1, Math.round(props.width ?? VIRAL_REMOTION_WIDTH));
  const outputHeight = Math.max(1, Math.round(props.height ?? VIRAL_REMOTION_HEIGHT));
  const isCompactExport = outputWidth <= 720 || outputHeight <= 1280;
  const jpegQuality = isCompactExport ? 80 : 88;
  const crf = isCompactExport ? 23 : 20;
  const x264Preset = isCompactExport ? "ultrafast" : "veryfast";

  try {
    const rendererModuleName = "@remotion/renderer";
    const { renderMedia, selectComposition } = await runtimeImport<RendererModule>(rendererModuleName);
    await mkdir(REMOTION_PUBLIC_TEMP_DIR, { recursive: true });
    await writeFile(publicFilePath, Buffer.from(await video.arrayBuffer()));

    const serveUrl = await getRemotionServeUrl();
    const inputProps: ViralRemotionCompositionProps = {
      ...props,
      baseVideoSrc: `${REMOTION_ASSET_BASE_URL.replace(/\/+$/, "")}/${publicVideoPath}`,
    };

    const composition = await selectComposition({
      serveUrl,
      id: VIRAL_REMOTION_COMPOSITION_ID,
      inputProps,
      logLevel: "error",
      browserExecutable: CHROME_EXECUTABLE,
    });

    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      outputLocation: outputPath,
      overwrite: true,
      imageFormat: "jpeg",
      jpegQuality,
      pixelFormat: "yuv420p",
      crf,
      x264Preset,
      logLevel: "error",
      licenseKey: "free-license",
      browserExecutable: CHROME_EXECUTABLE,
      concurrency: REMOTION_RENDER_CONCURRENCY,
    });
  } finally {
    await rm(publicFilePath, { force: true });
  }
}

export async function POST(request: NextRequest) {
  let outputPath: string | null = null;

  try {
    const formData = await request.formData();
    const video = formData.get("video");
    if (!(video instanceof File)) {
      throw new InvalidRenderRequestError("Missing video file.");
    }

    const props: ViralRemotionRenderProps = {
      durationSeconds: parseDurationSeconds(formData.get("durationSeconds")),
      width: parseDimension(formData.get("width"), VIRAL_REMOTION_WIDTH, "width"),
      height: parseDimension(formData.get("height"), VIRAL_REMOTION_HEIGHT, "height"),
      title: parseOptionalString(formData.get("title")),
      titleStyle: parseJsonField<ViralRemotionTitleStyle | null>(formData.get("titleStyle"), "titleStyle"),
      hookText: parseOptionalString(formData.get("hookText")),
      overlayTexts: parseJsonField<string[]>(formData.get("overlayTexts"), "overlayTexts"),
      titleWindow: parseJsonField<RemotionTitleWindow | null>(formData.get("titleWindow"), "titleWindow"),
      overlayWindows: parseJsonField<RemotionOverlayWindow[]>(formData.get("overlayWindows"), "overlayWindows"),
      transitionMarkers: parseJsonField<ViralRemotionTransitionMarker[]>(
        formData.get("transitionMarkers"),
        "transitionMarkers"
      ),
    };

    const requestId = randomUUID();
    outputPath = join(tmpdir(), `viral-remotion-output-${requestId}.mp4`);
    await renderViralRemotionVideo(video, outputPath, props);

    const rendered = await readFile(outputPath);

    return new NextResponse(rendered, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="viral-remotion-export.mp4"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server render error.";
    console.error("[render-viral-remotion] Failed to render Viral export", error);

    return NextResponse.json(
      { error: message },
      { status: error instanceof InvalidRenderRequestError ? 400 : 500 }
    );
  } finally {
    await Promise.allSettled(
      [outputPath]
        .filter((value): value is string => Boolean(value))
        .map((filePath) => rm(filePath, { force: true }))
    );
  }
}
