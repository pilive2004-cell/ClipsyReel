import { NextRequest, NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { join, resolve } from "path";

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  let videoPath: string | null = null;
  let audioPath: string | null = null;
  let outputPath: string | null = null;

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    const audioFile = formData.get("audio") as File | null;

    if (!videoFile) {
      return NextResponse.json(
        { error: "Missing video file" },
        { status: 400 }
      );
    }

    if (!audioFile) {
      return NextResponse.json(
        { error: "Missing audio file" },
        { status: 400 }
      );
    }

    const tmpDir = tmpdir();
    const sessionId = randomUUID();
    const audioExtension = audioFile.type.includes("mpeg") || audioFile.name.toLowerCase().endsWith(".mp3")
      ? "mp3"
      : audioFile.type.includes("wav") || audioFile.name.toLowerCase().endsWith(".wav")
        ? "wav"
        : audioFile.type.includes("aac") || audioFile.name.toLowerCase().endsWith(".aac")
          ? "aac"
          : "audio";

    videoPath = join(tmpDir, `video-${sessionId}.mp4`);
    audioPath = join(tmpDir, `audio-${sessionId}.${audioExtension}`);
    outputPath = join(tmpDir, `output-${sessionId}.mp4`);

    // Write temporary files
    const videoBuffer = await videoFile.arrayBuffer();
    const audioBuffer = await audioFile.arrayBuffer();

    await writeFile(videoPath, Buffer.from(videoBuffer));
    await writeFile(audioPath, Buffer.from(audioBuffer));

    // Use FFmpeg to mux video + audio. Prefer the bundled binary so the app
    // doesn't depend on a system-wide ffmpeg installation.
    const configuredFfmpegBinary = process.env.FFMPEG_BINARY?.trim();
    const localFfmpegBinary = resolve(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
    const ffmpegBinary = configuredFfmpegBinary && configuredFfmpegBinary !== "ffmpeg"
      ? configuredFfmpegBinary
      : existsSync(localFfmpegBinary)
        ? localFfmpegBinary
        : ffmpegPath || "ffmpeg";

    try {
      await execFileAsync(ffmpegBinary, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoPath,
        "-stream_loop",
        "-1",
        "-i",
        audioPath,
        "-filter_complex",
        "[0:a]volume=1.0[original];[1:a]volume=0.32[music];[original][music]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        outputPath,
      ]);
    } catch (mixError) {
      console.warn("Video/audio mix fallback: exporting generated music without original track.", mixError);
      await execFileAsync(ffmpegBinary, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoPath,
        "-stream_loop",
        "-1",
        "-i",
        audioPath,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        outputPath,
      ]);
    }

    // Read output file
    const result = await readFile(outputPath);

    return new NextResponse(result, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=reel-with-music.mp4",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Video muxing error:", message);
    return NextResponse.json(
      { error: `Failed to mux video and audio: ${message}` },
      { status: 500 }
    );
  } finally {
    // Cleanup temporary files
    try {
      if (videoPath) await unlink(videoPath);
      if (audioPath) await unlink(audioPath);
      if (outputPath) await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
