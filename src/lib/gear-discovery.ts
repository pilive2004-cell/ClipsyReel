import { GEAR_LABELS, GEAR_CATEGORY_KEYS, GearCategoryKey, GearSelections } from "@/data/gearCatalog";

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

type BrandNewsTemplate = {
  launches: string[];
  update: string;
  url: string;
};

const BRAND_NEWS: Record<string, BrandNewsTemplate> = {
  AdvRider: {
    launches: ["Adventure riding news", "Route stories", "Gear inspiration"],
    update: "Latest adventure bike coverage, overland route inspiration and rider-tested gear from AdvRider.",
    url: "https://www.advrider.com/?utm_source=google&utm_medium=organic",
  },
  BMW: {
    launches: ["R 1300 GS Adventure", "M 1000 XR M Competition", "GS Rallye GTX 2"],
    update: "Adaptive riding assist and premium touring updates.",
    url: "https://www.bmw-motorrad.com/",
  },
  KTM: {
    launches: ["990 Adventure R", "390 Enduro R", "890 Adventure Tech Pack"],
    update: "Rally-focused chassis revisions and suspension updates.",
    url: "https://www.ktm.com/",
  },
  Ducati: {
    launches: ["Multistrada V4 RS", "DesertX Rally Tech", "Hypermotard 698 RVE"],
    update: "Performance package refresh for road and mixed terrain.",
    url: "https://www.ducati.com/",
  },
  Yamaha: {
    launches: ["Ténéré 700 World Raid+", "Tracer 9 GT+ Touring Pack", "MT-09 SP 2"],
    update: "Connected cockpit enhancements and touring refinements.",
    url: "https://www.yamaha-motor.eu/",
  },
  Honda: {
    launches: ["Africa Twin Adventure Sports ES", "CRF Rally Pro", "XL750 Transalp Touring"],
    update: "Adventure electronics and long-distance comfort upgrades.",
    url: "https://www.honda.com/",
  },
  Michelin: {
    launches: ["Anakee Adventure Evo", "Road 7", "Anakee Wild 2"],
    update: "New dual-compound endurance profile announced.",
    url: "https://www.michelin.com/",
  },
  Pirelli: {
    launches: ["Scorpion Trail IV", "Scorpion Rally STR Evo", "Diablo Trackday Pro"],
    update: "Sport/adventure grip update for mixed surface use.",
    url: "https://www.pirelli.com/",
  },
  Garmin: {
    launches: ["zūmo XT3", "GPSMAP Moto Edition", "inReach Mini 3"],
    update: "Route synchronization and satellite safety improvements.",
    url: "https://www.garmin.com/",
  },
  DJI: {
    launches: ["Action 6 Pro", "Mini 5 Adventure", "Avata 3"],
    update: "Stabilization and low-light capture upgrades.",
    url: "https://www.dji.com/",
  },
  GoPro: {
    launches: ["HERO14 Black", "MAX 2", "Helmet HUD Link"],
    update: "Enhanced horizon lock and ride telemetry overlays.",
    url: "https://www.gopro.com/",
  },
  Touratech: {
    launches: ["ZEGA Evo X", "Adventure Rack 2.0", "Travel Cockpit GPS Pro"],
    update: "Overland luggage and long-distance equipment updates.",
    url: "https://www.touratech.com/",
  },
  Leatt: {
    launches: ["ADV 9.5 Carbon", "Enduro 4.0 line", "HydraDri travel armor"],
    update: "Protective gear refresh focused on ventilation and impact safety.",
    url: "https://leatt.com/",
  },
};

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

function buildWebsiteScreenshotUrl(url: string): string {
  const fallbackBrand = url.includes("advrider") ? "AdvRider" : url.includes("bikeexif") ? "Bike EXIF" : url.includes("off-road") ? "Off-Road.com" : url.includes("motorcyclenews") ? "Motorcycle News" : "Adventure";
  return brandLogoImage(fallbackBrand);
}

const EDITORIAL_NEWS_SOURCES: Array<{
  id: string;
  brand: string;
  category: GearCategoryKey;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  ctaLabel: string;
  url: string;
  featured?: boolean;
}> = [
  {
    id: "advrider-adventure-riding-news",
    brand: "AdvRider",
    category: "motorcycle",
    title: "Latest adventure riding news",
    subtitle: "Moto • Editorial coverage",
    summary: "Fresh route inspiration, rider stories and gear updates from AdvRider.",
    description: "Official adventure riding coverage from AdvRider, focused on long-distance travel, bike reviews, gear and overland inspiration.",
    ctaLabel: "Read AdvRider",
    url: "https://www.advrider.com/?utm_source=google&utm_medium=organic",
    featured: true,
  },
  {
    id: "bikeexif-custom-builds",
    brand: "Bike EXIF",
    category: "helmet",
    title: "Custom builds & motorcycle culture",
    subtitle: "Style • Design stories",
    summary: "Cafe racer, scrambler and custom builds from one of the most visual moto communities.",
    description: "Bike EXIF brings a premium design lens to custom motorcycles, cafe racers, scramblers and rider culture reporting.",
    ctaLabel: "Browse Bike EXIF",
    url: "https://www.bikeexif.com/",
    featured: true,
  },
  {
    id: "offroad-all-terrain-news",
    brand: "Off-Road.com",
    category: "navigation",
    title: "Off-road route & terrain news",
    subtitle: "Navigation • Trail coverage",
    summary: "Technical trail reports, off-road destinations and rider-safe adventure updates.",
    description: "Off-Road.com offers a practical, trail-focused editorial angle for adventure riders and overlanders planning bigger routes.",
    ctaLabel: "Read Off-Road",
    url: "https://www.off-road.com/",
  },
  {
    id: "motorcyclenews-rider-updates",
    brand: "Motorcycle News",
    category: "tires",
    title: "Bike tests & rider updates",
    subtitle: "Moto • Reviews",
    summary: "Current news, product tests and practical riding updates from a trusted motorcycle media source.",
    description: "Motorcycle News keeps the feed grounded in review-driven coverage, model launches and rider-focused updates.",
    ctaLabel: "Open MCN",
    url: "https://www.motorcyclenews.com/",
  },
];

const EDITORIAL_NEWS_ITEMS: GearDiscoveryItem[] = [...EDITORIAL_NEWS_SOURCES]
  .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
  .map((source) => ({
    id: source.id,
    brand: source.brand,
    brandLogo: brandLogoImage(source.brand),
    category: source.category,
    title: source.title,
    subtitle: source.subtitle,
    summary: source.summary,
    description: source.description,
    ctaLabel: source.ctaLabel,
    ctaUrl: source.url,
    kind: "brand-news",
    featured: source.featured,
    image: buildWebsiteScreenshotUrl(source.url),
  }));

export async function loadGearDiscoveryItems(selections: GearSelections): Promise<GearDiscoveryItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 180));
  const items: GearDiscoveryItem[] = [];

  for (const key of GEAR_CATEGORY_KEYS) {
    const selection = selections[key];
    const brand = selection.brand.trim();
    if (!brand) continue;

    const model = (selection.customModel.trim() || selection.model.trim()).trim();
    const known = BRAND_NEWS[brand];
    const launches = known?.launches ?? [`${brand} latest release`, `${brand} performance update`];
    const url = known?.url ?? "https://www.motorcyclenews.com/";
    const update = known?.update ?? "Latest product updates and rider-focused improvements.";

    const newModelSummary = model
      ? `${brand} ${model} • ${launches[0]}`
      : `${brand} • ${launches[0]}`;

    items.push({
      id: `${key}-${brand}-new-model`.toLowerCase().replace(/\s+/g, "-"),
      brand,
      brandLogo: brandLogoImage(brand),
      category: key,
      title: launches[0],
      subtitle: `${GEAR_LABELS[key]} • New model`,
      summary: newModelSummary,
      description: model
        ? `Because you selected ${brand} ${model}, here is the closest new release to watch.`
        : `Because you selected ${brand} for ${GEAR_LABELS[key]}, here is the latest model reveal.`,
      ctaLabel: "See release",
      ctaUrl: url,
      kind: "new-model",
      featured: true,
      image: buildWebsiteScreenshotUrl(url),
    });

    const brandSummary = update.length > 54 ? `${update.slice(0, 51).trimEnd()}…` : update;

    items.push({
      id: `${key}-${brand}-brand-news`.toLowerCase().replace(/\s+/g, "-"),
      brand,
      brandLogo: brandLogoImage(brand),
      category: key,
      title: `${brand} brand update`,
      subtitle: `${GEAR_LABELS[key]} • Brand news`,
      summary: brandSummary,
      description: update,
      ctaLabel: "Read news",
      ctaUrl: url,
      kind: "brand-news",
      image: buildWebsiteScreenshotUrl(url),
    });
  }

  return [...EDITORIAL_NEWS_ITEMS, ...items].slice(0, 12);
}
