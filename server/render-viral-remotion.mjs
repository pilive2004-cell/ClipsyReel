import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const REMOTION_PUBLIC_TEMP_DIR = resolve(process.cwd(), "public", "remotion-temp");
const REMOTION_ENTRY = resolve(process.cwd(), "src", "modules", "remotion", "server", "Root.tsx");
const VIRAL_REMOTION_COMPOSITION_ID = "ViralExportComposition";
const REMOTION_ASSET_BASE_URL = process.env.REMOTION_ASSET_BASE_URL?.trim() || "http://127.0.0.1:3000";
const REMOTION_BUNDLE_DIR = resolve(process.cwd(), ".remotion-bundles", "viral-export");
const CHROME_EXECUTABLE =
  process.env.REMOTION_BROWSER_EXECUTABLE?.trim() ||
  (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : null);

async function main() {
  const [, , inputPath, propsPath, outputPath] = process.argv;

  if (!inputPath || !propsPath || !outputPath) {
    throw new Error("Usage: node server/render-viral-remotion.mjs <input> <props.json> <output>");
  }

  const props = JSON.parse(await readFile(propsPath, "utf8"));
  const sessionId = randomUUID();
  const publicFileName = `viral-base-${sessionId}.mp4`;
  const publicFilePath = resolve(REMOTION_PUBLIC_TEMP_DIR, publicFileName);
  const publicVideoPath = `remotion-temp/${publicFileName}`;
  const tempOutputPath = outputPath || join(tmpdir(), `viral-remotion-output-${sessionId}.mp4`);

  try {
    await mkdir(REMOTION_PUBLIC_TEMP_DIR, { recursive: true });
    await mkdir(REMOTION_BUNDLE_DIR, { recursive: true });
    await writeFile(publicFilePath, await readFile(inputPath));

    const serveUrl = await bundle({
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

    const inputProps = {
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
      outputLocation: tempOutputPath,
      overwrite: true,
      pixelFormat: "yuv420p",
      crf: 20,
      logLevel: "error",
      licenseKey: "free-license",
      browserExecutable: CHROME_EXECUTABLE,
    });

    const rendered = await readFile(tempOutputPath);
    await writeFile(outputPath, rendered);
  } finally {
    await Promise.allSettled([
      rm(publicFilePath, { force: true }),
      outputPath === tempOutputPath ? Promise.resolve() : rm(tempOutputPath, { force: true }),
    ]);
  }
}

main().catch((error) => {
  console.error("[render-viral-remotion-script] Rendering failed", error);
  process.exitCode = 1;
});
