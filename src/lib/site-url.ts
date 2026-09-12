const FALLBACK_SITE_URL = "https://clipsyreel.netlify.app";

function normaliseSiteUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function getSiteUrl(): string {
  return (
    normaliseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normaliseSiteUrl(process.env.SITE_URL) ??
    normaliseSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normaliseSiteUrl(process.env.VERCEL_URL) ??
    FALLBACK_SITE_URL
  );
}
