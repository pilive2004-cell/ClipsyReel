import { GearCategoryKey } from "@/data/gearCatalog";

export interface GearDiscoveryItem {
  id: string;
  brand: string;
  brandLogo: string;
  category: GearCategoryKey;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  kind: "new-model" | "brand-news" | "community";
  featured?: boolean;
  image: string;
}

interface AdventureNewsApiItem {
  id: string;
  brand: string;
  category: GearCategoryKey;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  kind: "brand-news";
  featured?: boolean;
  image: string | null;
}

const ADVENTURE_NEWS_FALLBACKS: AdventureNewsApiItem[] = [
  {
    id: "adventuremotorcycle-feed",
    brand: "Adventure Motorcycle",
    category: "motorcycle",
    title: "Adventure Motorcycle RSS",
    subtitle: "Adventure Motorcycle • RSS feed",
    summary: "Open the Adventure Motorcycle feed for the latest stories and route inspiration.",
    description: "Fallback source card when the live RSS feed is unavailable from the current network.",
    ctaLabel: "Open feed",
    ctaUrl: "https://adventuremotorcycle.com/feed",
    kind: "brand-news",
    featured: true,
    image: null,
  },
  {
    id: "rideapart-rss-directory",
    brand: "RideApart",
    category: "motorcycle",
    title: "RideApart RSS directory",
    subtitle: "RideApart • RSS feeds",
    summary: "Browse RideApart's feed directory for motorcycle and adventure coverage.",
    description: "Fallback source card for the RideApart RSS directory.",
    ctaLabel: "Open RSS",
    ctaUrl: "https://www.rideapart.com/rss/",
    kind: "brand-news",
    image: null,
  },
  {
    id: "rideapart-articles-all",
    brand: "RideApart",
    category: "motorcycle",
    title: "RideApart latest articles",
    subtitle: "RideApart • all articles",
    summary: "Open the RideApart all-articles feed for the latest motorcycle headlines.",
    description: "Fallback source card for the RideApart article feed.",
    ctaLabel: "Open feed",
    ctaUrl: "https://www.rideapart.com/rss/articles/all/",
    kind: "brand-news",
    image: null,
  },
];

function brandLogoImage(brand: string): string {
  const hue = Math.abs(brand.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  const safeBrand = brand
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue} 85% 55%)"/>
          <stop offset="100%" stop-color="hsl(${(hue + 36) % 360} 74% 34%)"/>
        </linearGradient>
      </defs>
      <rect width="640" height="240" rx="44" fill="url(#g)"/>
      <rect x="12" y="12" width="616" height="216" rx="36" fill="rgba(15,23,42,0.18)"/>
      <text x="320" y="144" text-anchor="middle" fill="#fff" font-size="74" font-weight="800" font-family="Arial, sans-serif" letter-spacing="1.2">${safeBrand}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildLogoFallbackImage(
  title: string,
  subtitle: string,
  logoSrc: string | null | undefined,
  colors: [string, string],
): string {
  const safeTitle = escapeSvgText(title);
  const safeSubtitle = escapeSvgText(subtitle);
  const safeLogoSrc = logoSrc ? escapeSvgText(logoSrc) : "";
  const logoBlock = safeLogoSrc
    ? `<rect x="438" y="160" width="324" height="180" rx="26" fill="rgba(15,23,42,0.34)"/>
<image href="${safeLogoSrc}" x="462" y="180" width="276" height="140" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${colors[0]}"/>
<stop offset="100%" stop-color="${colors[1]}"/>
</linearGradient>
</defs>
<rect width="1200" height="800" fill="#0b1220"/>
<rect width="1200" height="800" fill="url(#g)" opacity="0.35"/>
<circle cx="980" cy="140" r="220" fill="${colors[1]}" opacity="0.18"/>
<circle cx="180" cy="120" r="200" fill="${colors[0]}" opacity="0.16"/>
${logoBlock}
<text x="64" y="650" fill="#f8fafc" font-size="62" font-family="Arial, sans-serif" font-weight="700">${safeTitle}</text>
<text x="64" y="712" fill="#cbd5e1" font-size="36" font-family="Arial, sans-serif">${safeSubtitle}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeItems(items: AdventureNewsApiItem[]): GearDiscoveryItem[] {
  return items.map((item) => {
    const brandLogo = brandLogoImage(item.brand);
    return {
      ...item,
      brandLogo,
      image: item.image || buildLogoFallbackImage(item.title, item.subtitle, brandLogo, ["#38bdf8", "#ec4899"]),
    };
  });
}

export async function loadGearDiscoveryItems(): Promise<GearDiscoveryItem[]> {
  try {
    const response = await fetch("/api/adventure-news", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Adventure news request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { items?: AdventureNewsApiItem[] };
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length > 0) {
      return normalizeItems(items);
    }
  } catch (error) {
    console.error("[gear-discovery] adventure news RSS loading failed", error);
  }

  return normalizeItems(ADVENTURE_NEWS_FALLBACKS);
}
