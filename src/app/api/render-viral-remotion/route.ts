import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { resolve, join } from "path";
import { readFile, rm, writeFile } from "fs/promises";
import type {
  RemotionOverlayWindow,
  RemotionTitleWindow,
  ViralRemotionRenderProps,
  ViralRemotionTitleStyle,
  ViralRemotionTransitionMarker,
} from "@/modules/remotion/render-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const renderScriptPath = resolve(process.cwd(), "server", "render-viral-remotion.mjs");

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

export async function POST(request: NextRequest) {
  let inputPath: string | null = null;
  let propsPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const formData = await request.formData();
    const video = formData.get("video");
    if (!(video instanceof File)) {
      throw new InvalidRenderRequestError("Missing video file.");
    }

    const props: ViralRemotionRenderProps = {
      durationSeconds: parseDurationSeconds(formData.get("durationSeconds")),
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

    const videoBuffer = new Uint8Array(await video.arrayBuffer());
    const requestId = randomUUID();
    inputPath = join(tmpdir(), `viral-remotion-input-${requestId}.mp4`);
    propsPath = join(tmpdir(), `viral-remotion-props-${requestId}.json`);
    outputPath = join(tmpdir(), `viral-remotion-output-${requestId}.mp4`);

    await writeFile(inputPath, Buffer.from(videoBuffer));
    await writeFile(propsPath, JSON.stringify(props));

    await execFileAsync(process.execPath, [
      renderScriptPath,
      inputPath,
      propsPath,
      outputPath,
    ]);

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
      [inputPath, propsPath, outputPath]
        .filter((value): value is string => Boolean(value))
        .map((filePath) => rm(filePath, { force: true }))
    );
  }
}
