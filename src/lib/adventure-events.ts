import { ReelStyle } from "@/types";

export type AdventureEventType =
  | "Adventure Ride"
  | "Raid"
  | "Rally Raid"
  | "Enduro"
  | "Hard Enduro"
  | "Travel Event"
  | "Adventure Festival"
  | "Offroad Festival"
  | "Track Day"
  | "Road Racing"
  | "MotoGP"
  | "MX"
  | "Desert Rally"
  | "GS Meeting"
  | "Overland Event";

export type DiscoveryProfile = "adventure" | "sport" | "travel";

export interface AdventureEventRecord {
  id: string;
  name: string;
  logo: string | null;
  type: AdventureEventType;
  country: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  officialWebsite: string;
  image: string | null;
  featured: boolean;
  // Monetization-ready metadata.
  placementTier?: "organic" | "featured" | "sponsored" | "premium";
  sponsorshipLabel?: string | null;
  affiliateCode?: string | null;
  tags: string[];
}

function websiteLogo(name: string, officialWebsite?: string): string {
  const initials = name
    .split(/\s|[-_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "M";

  const hue = Math.abs(name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="hsl(${hue} 78% 60%)"/>
          <stop offset="100%" stop-color="hsl(${(hue + 35) % 360} 72% 36%)"/>
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="56" fill="url(#g)"/>
      <circle cx="128" cy="128" r="90" fill="rgba(15,23,42,0.22)"/>
      <path d="M66 170 L128 86 L190 170" stroke="rgba(255,255,255,0.9)" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M96 170 L128 130 L160 170" stroke="rgba(255,255,255,0.95)" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="128" y="152" text-anchor="middle" fill="white" font-size="68" font-weight="800" font-family="Arial, sans-serif">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function eventHeroImage(name: string, type: string | string[], country?: string): string {
  const typeList = Array.isArray(type) ? type : [type];
  const combined = typeList.join(" ").toLowerCase();
  const palette = {
    default: ["#111827", "#312e81", "#a855f7"],
    rally: ["#0f172a", "#7c2d12", "#f59e0b"],
    adventure: ["#0f172a", "#14532d", "#22c55e"],
    sport: ["#111827", "#1d4ed8", "#38bdf8"],
    travel: ["#172554", "#0f766e", "#34d399"],
  } as const;

  const key = /rally|raid|enduro|desert|offroad|adventure|gs/i.test(combined)
    ? "rally"
    : /track|race|motogp|sport|road/i.test(combined)
      ? "sport"
      : /travel|festival|overland|meeting/i.test(combined)
        ? "travel"
        : "adventure";

  const colors = palette[key] ?? palette.default;
  return buildMotocycleEditorialArt({
    title: name,
    subtitle: `${typeList.join(" • ")}${country ? ` • ${country}` : ""}`,
    colors,
    accentLabel: "Adventure",
  });
}

function buildMotocycleEditorialArt({
  title,
  subtitle,
  colors,
  accentLabel,
}: {
  title: string;
  subtitle: string;
  colors: readonly [string, string, string];
  accentLabel: string;
}): string {
  const safeTitle = escapeSvgText(title);
  const safeSubtitle = escapeSvgText(subtitle);
  const safeAccent = escapeSvgText(accentLabel);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colors[0]}"/>
          <stop offset="50%" stop-color="${colors[1]}"/>
          <stop offset="100%" stop-color="${colors[2]}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)"/>
      <circle cx="1010" cy="120" r="220" fill="white" opacity="0.08"/>
      <circle cx="180" cy="650" r="260" fill="black" opacity="0.16"/>
      <path d="M0 560 L250 420 L420 520 L620 310 L840 430 L1200 260 L1200 800 L0 800 Z" fill="rgba(15,23,42,0.42)"/>
      <g transform="translate(80 250)" fill="none" stroke="rgba(255,255,255,0.9)" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="160" cy="270" r="70" stroke-width="10"/>
        <circle cx="500" cy="270" r="70" stroke-width="10"/>
        <path d="M160 270 L260 190 L400 190 L500 270 M260 190 L240 120 L330 120 L400 190 M390 190 L320 270 M220 150 L320 270 M500 270 L570 200 L660 200" stroke-width="12"/>
        <path d="M330 120 L420 80" stroke-width="10"/>
        <path d="M240 120 L170 90" stroke-width="10"/>
      </g>
      <rect x="60" y="70" width="200" height="42" rx="21" fill="rgba(255,255,255,0.17)"/>
      <text x="80" y="98" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="700">${safeAccent}</text>
      <text x="60" y="610" fill="#f8fafc" font-size="64" font-family="Arial, sans-serif" font-weight="700">${safeTitle}</text>
      <text x="60" y="670" fill="#e2e8f0" font-size="30" font-family="Arial, sans-serif">${safeSubtitle}</text>
    </svg>
  `;
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

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function buildWebsiteScreenshotUrl(url: string, provider: "mshots" = "mshots"): string | null {
  void provider;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    return null;
  } catch {
    return null;
  }
}

function getJinaProxyUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

async function resolveOfficialWebsiteImage(url: string): Promise<string | null> {
  const proxyUrl = getJinaProxyUrl(url);
  if (!proxyUrl) return null;

  try {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 2200);
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        Accept: "text/markdown, text/html, application/json",
      },
    }).finally(() => {
      globalThis.clearTimeout(timeoutId);
    });
    if (!response.ok) return null;

    const text = await response.text();
    const imageMatches = [
      ...text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g),
      ...text.matchAll(/(?:og:image|twitter:image(?:-src)?)[^\n]*?content=["']([^"']+)["']/gi),
    ];

    for (const match of imageMatches) {
      const candidate = (match[1] ?? match[0] ?? "").trim();
      if (!candidate || /^data:/.test(candidate)) continue;
      if (!/^https?:\/\//i.test(candidate)) continue;
      if (/\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(candidate) || /wp-content|uploads|images|media\//i.test(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Ignore proxy failures; the local generated art remains the fallback.
  }

  return null;
}

const ADVENTURE_EVENT_DATA: AdventureEventRecord[] = [
  {
    id: "dune-rally-tunisia-2027",
    name: "Dune Rally Tunisia",
    logo: websiteLogo("Dune Rally Tunisia"),
    type: "Rally Raid",
    country: "Tunisia",
    location: "Merzouga",
    startDate: "2027-04-18T08:00:00Z",
    endDate: "2027-04-24T18:00:00Z",
    description: "Desert navigation and dune stages in one of the most iconic North African rally experiences.",
    officialWebsite: "https://www.owaka.com/rallye-raid/dune-rally-tunisia-swank-rally-tunisia",
    image: eventHeroImage("Dune Rally Tunisia", "Rally Raid", "Tunisia"),
    featured: true,
    placementTier: "featured",
    tags: ["adventure", "rally", "desert"],
  },
  {
    id: "addax-rally-2027",
    name: "Addax Rally",
    logo: websiteLogo("Addax Rally"),
    type: "Rally Raid",
    country: "Morocco",
    location: "Merzouga",
    startDate: "2027-05-03T08:00:00Z",
    endDate: "2027-05-08T18:00:00Z",
    description: "A true challenge in the Moroccan desert with roadbook navigation, dunes and long-range endurance.",
    officialWebsite: "https://www.owaka.com/rallye-raid/addax-rally",
    image: eventHeroImage("Addax Rally", "Rally Raid", "Morocco"),
    featured: true,
    placementTier: "featured",
    tags: ["adventure", "rally", "desert"],
  },
  {
    id: "raid-iberica-2027",
    name: "Raid'Iberica",
    logo: websiteLogo("Raid'Iberica"),
    type: "Raid",
    country: "Spain",
    location: "Iberian routes",
    startDate: "2027-06-15T08:00:00Z",
    endDate: "2027-06-21T18:00:00Z",
    description: "Cross-border adventure riding and route discovery through mountain, trail and discovery stages.",
    officialWebsite: "https://www.owaka.com/raid/raid-iberica",
    image: eventHeroImage("Raid'Iberica", "Raid", "Spain"),
    featured: true,
    placementTier: "featured",
    tags: ["adventure", "raid", "travel"],
  },
  {
    id: "monterra-raid-2027",
    name: "Monterra Raid",
    logo: websiteLogo("Monterra Raid"),
    type: "Raid",
    country: "Italy",
    location: "Monterra",
    startDate: "2027-07-10T08:00:00Z",
    endDate: "2027-07-16T18:00:00Z",
    description: "Trail-focused and technical adventure challenge for riders looking for a demanding offroad journey.",
    officialWebsite: "https://www.owaka.com/raid/monterra-raid",
    image: eventHeroImage("Monterra Raid", "Raid", "Italy"),
    featured: false,
    placementTier: "organic",
    tags: ["adventure", "raid", "offroad"],
  },
  {
    id: "lamas-rally-monviso-2027",
    name: "Lamas Rally Monviso",
    logo: websiteLogo("Lamas Rally Monviso"),
    type: "Rally Raid",
    country: "Italy",
    location: "Monviso",
    startDate: "2027-09-12T08:00:00Z",
    endDate: "2027-09-18T18:00:00Z",
    description: "Italian alpine exploration, scenic gravel lanes and a classic roadbook-style rally feel.",
    officialWebsite: "https://www.owaka.com/rallye-raid/lamas-rally-monviso",
    image: eventHeroImage("Lamas Rally Monviso", "Rally Raid", "Italy"),
    featured: false,
    placementTier: "organic",
    tags: ["adventure", "rally", "mountain"],
  },
  {
    id: "queen-trophy-2027",
    name: "Queen Trophy",
    logo: websiteLogo("Queen Trophy"),
    type: "Raid",
    country: "Italy",
    location: "Italian Alps",
    startDate: "2027-05-22T08:00:00Z",
    endDate: "2027-05-28T18:00:00Z",
    description: "An immersive three-day Italian motorcycle adventure mixing scenic routes, offroad sections and camp culture.",
    officialWebsite: "https://www.owaka.com/raid/queen-trophy",
    image: eventHeroImage("Queen Trophy", "Raid", "Italy"),
    featured: false,
    placementTier: "organic",
    tags: ["adventure", "raid", "travel"],
  },
  {
    id: "hellas-rally-2027",
    name: "Hellas Rally",
    logo: websiteLogo("Hellas Rally"),
    type: "Rally Raid",
    country: "Greece",
    location: "Nafpaktos",
    startDate: "2027-05-24T08:00:00Z",
    endDate: "2027-05-31T18:00:00Z",
    description: "Legendary multi-day rally raid with mountain, coast and technical navigation stages.",
    officialWebsite: "https://www.hellasrally.org/",
    image: eventHeroImage("Hellas Rally", "Rally Raid", "Greece"),
    featured: true,
    placementTier: "featured",
    tags: ["adventure", "rally", "offroad"],
  },
  {
    id: "gibraltar-race-2027",
    name: "Gibraltar Race",
    logo: websiteLogo("Gibraltar Race"),
    type: "Adventure Ride",
    country: "Spain",
    location: "Malaga",
    startDate: "2027-06-10T08:00:00Z",
    endDate: "2027-06-19T18:00:00Z",
    description: "Adventure navigation challenge crossing varied terrain with strong overland spirit.",
    officialWebsite: "https://www.gibraltarrace.com/",
    image: eventHeroImage("Gibraltar Race", "Adventure Ride", "Spain"),
    featured: false,
    placementTier: "organic",
    tags: ["adventure", "travel", "overland"],
  },
  {
    id: "bosnia-rally-2027",
    name: "Bosnia Rally",
    logo: websiteLogo("Bosnia Rally"),
    type: "Rally Raid",
    country: "Bosnia and Herzegovina",
    location: "Sarajevo",
    startDate: "2027-08-20T08:00:00Z",
    endDate: "2027-08-27T18:00:00Z",
    description: "Fast Balkan rally routes with technical sectors and strong endurance focus.",
    officialWebsite: "https://www.bosniarally.com/",
    image: eventHeroImage("Bosnia Rally", "Rally Raid", "Bosnia and Herzegovina"),
    featured: false,
    placementTier: "organic",
    tags: ["adventure", "rally", "desert"],
  },
  {
    id: "bmw-gs-trophy-2027",
    name: "BMW GS Trophy",
    logo: websiteLogo("BMW GS Trophy"),
    type: "GS Meeting",
    country: "South Africa",
    location: "Cape Town",
    startDate: "2027-09-14T08:00:00Z",
    endDate: "2027-09-21T18:00:00Z",
    description: "Iconic GS adventure challenge combining riding skills, navigation and team spirit.",
    officialWebsite: "https://www.bmw-motorrad.com/",
    image: eventHeroImage("BMW GS Trophy", "GS Meeting", "South Africa"),
    featured: true,
    placementTier: "featured",
    tags: ["adventure", "gs", "festival"],
  },
  {
    id: "adventure-country-tracks-2027",
    name: "Adventure Country Tracks Meetup",
    logo: websiteLogo("Adventure Country Tracks"),
    type: "Overland Event",
    country: "Portugal",
    location: "Porto",
    startDate: "2027-10-04T08:00:00Z",
    endDate: "2027-10-08T18:00:00Z",
    description: "Community overland gathering focused on routes, gear and long-distance exploration.",
    officialWebsite: "https://www.adventurecountrytracks.com/",
    image: eventHeroImage("Adventure Country Tracks Meetup", "Overland Event", "Portugal"),
    featured: false,
    placementTier: "organic",
    tags: ["adventure", "travel", "overland"],
  },
  {
    id: "motogp-italy-2027",
    name: "MotoGP Italian GP",
    logo: websiteLogo("MotoGP"),
    type: "MotoGP",
    country: "Italy",
    location: "Mugello",
    startDate: "2027-06-18T08:00:00Z",
    endDate: "2027-06-20T18:00:00Z",
    description: "Top-tier MotoGP weekend with high-speed battles and premium paddock atmosphere.",
    officialWebsite: "https://www.motogp.com/",
    image: eventHeroImage("MotoGP Italian GP", "MotoGP", "Italy"),
    featured: true,
    placementTier: "premium",
    sponsorshipLabel: "Featured Event",
    tags: ["sport", "track", "racing"],
  },
  {
    id: "isle-of-man-tt-2027",
    name: "Isle of Man TT",
    logo: websiteLogo("Isle of Man TT"),
    type: "Road Racing",
    country: "Isle of Man",
    location: "Douglas",
    startDate: "2027-05-29T08:00:00Z",
    endDate: "2027-06-11T18:00:00Z",
    description: "Historic and extreme road racing event with unmatched speed and adrenaline.",
    officialWebsite: "https://www.iomttraces.com/",
    image: eventHeroImage("Isle of Man TT", "Road Racing", "Isle of Man"),
    featured: true,
    placementTier: "featured",
    tags: ["sport", "racing", "moto"],
  },
  {
    id: "endurance-world-championship-2027",
    name: "FIM Endurance Championship",
    logo: websiteLogo("FIM Endurance Championship"),
    type: "Road Racing",
    country: "France",
    location: "Le Castellet",
    startDate: "2027-09-17T08:00:00Z",
    endDate: "2027-09-19T18:00:00Z",
    description: "Elite endurance racing with strategy, night riding and team performance.",
    officialWebsite: "https://www.fimewc.com/",
    image: eventHeroImage("FIM Endurance Championship", "Road Racing", "France"),
    featured: false,
    placementTier: "organic",
    tags: ["sport", "racing", "track"],
  },
  {
    id: "almeria-track-days-2027",
    name: "Almería Track Days",
    logo: websiteLogo("Circuito de Almería"),
    type: "Track Day",
    country: "Spain",
    location: "Circuito de Almería",
    startDate: "2027-04-12T08:00:00Z",
    endDate: "2027-04-15T18:00:00Z",
    description: "Performance-focused track sessions for sport riders and technical coaching.",
    officialWebsite: "https://www.circuitodealmeria.com/",
    image: eventHeroImage("Almería Track Days", "Track Day", "Spain"),
    featured: false,
    placementTier: "organic",
    tags: ["sport", "track", "training"],
  },
  {
    id: "adventure-festival-europe-2027",
    name: "Adventure Festival Europe",
    logo: websiteLogo("Adventure Festival"),
    type: "Adventure Festival",
    country: "Austria",
    location: "Innsbruck",
    startDate: "2027-07-02T08:00:00Z",
    endDate: "2027-07-04T18:00:00Z",
    description: "Outdoor and motorcycle travel festival with routes, talks and gear demos.",
    officialWebsite: "https://www.adventurefestival.com/",
    image: eventHeroImage("Adventure Festival Europe", "Adventure Festival", "Austria"),
    featured: false,
    placementTier: "organic",
    tags: ["travel", "festival", "adventure"],
  },
  {
    id: "overland-expo-europe-2027",
    name: "Overland Expo Europe",
    logo: websiteLogo("Overland Expo"),
    type: "Overland Event",
    country: "Germany",
    location: "Munich",
    startDate: "2027-09-03T08:00:00Z",
    endDate: "2027-09-05T18:00:00Z",
    description: "Global overland meetup for route planning, gear, and travel community.",
    officialWebsite: "https://www.overlandexpo.com/",
    image: eventHeroImage("Overland Expo Europe", "Overland Event", "Germany"),
    featured: true,
    placementTier: "featured",
    tags: ["travel", "overland", "meeting"],
  },
  {
    id: "motorcycle-travel-meet-2027",
    name: "Motorcycle Travel Gathering",
    logo: websiteLogo("Motorcycle Travel"),
    type: "Travel Event",
    country: "Italy",
    location: "Dolomites",
    startDate: "2027-08-06T08:00:00Z",
    endDate: "2027-08-09T18:00:00Z",
    description: "Scenic community rides, camp sessions and route-sharing for moto travelers.",
    officialWebsite: "https://www.motorcycle-travel.com/",
    image: eventHeroImage("Motorcycle Travel Gathering", "Travel Event", "Italy"),
    featured: false,
    placementTier: "organic",
    tags: ["travel", "meeting", "adventure"],
  },
];

const PROFILE_EVENT_IDS: Record<DiscoveryProfile, string[]> = {
  adventure: [
    "dune-rally-tunisia-2027",
    "addax-rally-2027",
    "raid-iberica-2027",
    "monterra-raid-2027",
    "lamas-rally-monviso-2027",
    "queen-trophy-2027",
    "hellas-rally-2027",
    "gibraltar-race-2027",
    "bosnia-rally-2027",
    "bmw-gs-trophy-2027",
    "adventure-country-tracks-2027",
  ],
  sport: [
    "motogp-italy-2027",
    "almeria-track-days-2027",
    "isle-of-man-tt-2027",
    "endurance-world-championship-2027",
  ],
  travel: [
    "adventure-festival-europe-2027",
    "overland-expo-europe-2027",
    "motorcycle-travel-meet-2027",
    "adventure-country-tracks-2027",
  ],
};

export function inferDiscoveryProfile(style: ReelStyle, videoNames: string[]): DiscoveryProfile {
  if (style === "sport") return "sport";
  if (style === "travel") return "travel";
  if (style === "adventure") return "adventure";

  const haystack = videoNames.join(" ").toLowerCase();
  if (/(track|motogp|race|racing|circuit|speed)/.test(haystack)) return "sport";
  if (/(trip|travel|roadtrip|tour|journey|overland)/.test(haystack)) return "travel";
  return "adventure";
}

export async function loadAdventureEvents(profile: DiscoveryProfile): Promise<AdventureEventRecord[]> {
  // Async-by-design so it can later be swapped to API-backed dynamic feeds
  // (featured/sponsored/affiliate) without changing the UI call site.
  await new Promise((resolve) => setTimeout(resolve, 220));
  const prioritized = new Set(PROFILE_EVENT_IDS[profile]);

  const sorted = [...ADVENTURE_EVENT_DATA].sort((a, b) => {
    const aPriority = prioritized.has(a.id) ? 1 : 0;
    const bPriority = prioritized.has(b.id) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const withImages = await Promise.all(
    sorted.slice(0, 10).map(async (event) => {
      if (!event.officialWebsite) return event;
      const resolvedImage = await resolveOfficialWebsiteImage(event.officialWebsite);
      return {
        ...event,
        image: resolvedImage ?? event.image ?? null,
      };
    }),
  );

  return withImages;
}
