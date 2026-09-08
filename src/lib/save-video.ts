"use client";

/**
 * Saves a rendered Reel/Story MP4 to the user's device.
 *
 * On mobile, a plain `<a download>` anchor click only ever lands the file in
 * the Files app (iOS) or the Downloads folder (Android) — never the actual
 * Photos/gallery app, which is what users expect for a video they're about
 * to post to Instagram. The Web Share API (`navigator.share` with a `files`
 * payload) is what triggers the OS-native share sheet, which on iOS Safari
 * includes a one-tap "Save Video" option that writes straight to Photos,
 * and on Android surfaces the Photos/Gallery app (or any installed
 * "save to gallery" target) as a share destination.
 *
 * We only attempt `navigator.share` on touch/mobile devices. Desktop Safari
 * and Chrome on macOS/Windows also implement `canShare`/`share` for files,
 * but their native share sheet on desktop typically only offers destinations
 * like Mail, Messages or AirDrop — there's no plain "save to disk" target,
 * so `share()` can resolve successfully without the user ever getting a
 * downloadable file, which looked exactly like "I can't download the video"
 * from the outside. Desktop always uses the classic, reliable anchor-download
 * instead, where a "save" is guaranteed.
 */
export async function saveBlobToDevice(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
    maxTouchPoints?: number;
  };
  const isMobileDevice = typeof window !== "undefined" && (nav.maxTouchPoints ?? 0) > 0 && /Mobi|Android|iPhone|iPad|iPod/i.test(nav.userAgent);

  if (isMobileDevice && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return "shared";
    } catch (err) {
      // AbortError just means the user cancelled/dismissed the share sheet
      // (e.g. tapped outside it) — that's not a failure, don't fall back to
      // a second, confusing download in that case.
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
      // Any other failure (rare — e.g. a share target crashing): fall back
      // to a normal download so the user still gets their file.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Safari (macOS in particular) can silently no-op a download-anchor click
  // if the anchor isn't actually attached to the document — it must be in
  // the DOM (even if invisible) for the click to reliably trigger a save.
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}

export async function saveVideoToDevice(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  return saveBlobToDevice(blob, filename);
}
