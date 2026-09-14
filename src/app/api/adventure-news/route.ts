import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

type GearCategoryKey =
  | "motorcycle"
  | "tires"
  | "helmet"
  | "jacket"
  | "pants"
  | "luggage"
  | "camera"
  | "drone"
  | "navigation";

interface AdventureNewsItem {
  id: string;
  sourceId: string;
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
  publishedAt: string | null;
}

interface FeedSource {
  id: string;
  brand: string;
  url: string;
  category: GearCategoryKey;
  subtitle: string;
}

const FEED_SOURCES: FeedSource[] = [
  {
    id: "adventuremotorcycle",
    brand: "Adventure Motorcycle",
    url: "https://adventuremotorcycle.com/feed",
    category: "motorcycle",
    subtitle: "Adventure Motorcycle • RSS",
  },
  {
    id: "rideapart-rss",
    brand: "RideApart",
    url: "https://www.rideapart.com/rss/",
    category: "motorcycle",
    subtitle: "RideApart • RSS",
  },
  {
    id: "rideapart-articles",
    brand: "RideApart",
    url: "https://www.rideapart.com/rss/articles/all/",
    category: "motorcycle",
    subtitle: "RideApart • latest articles",
  },
];

const MAX_ITEMS = 8;
const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string): string {
  return decodeXmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractTag(block: string, tagName: string): string | null {
  const safeTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${safeTag}\\b[^>]*>([\\s\\S]*?)</${safeTag}>`, "i"));
  return match ? match[1].trim() : null;
}

function extractAttr(block: string, tagName: string, attrName: string): string | null {
  const safeTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const safeAttr = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${safeTag}\\b[^>]*\\b${safeAttr}=(["'])(.*?)\\1[^>]*>`, "i"));
  return match ? match[2].trim() : null;
}

function extractImage(block: string): string | null {
  const direct = extractAttr(block, "enclosure", "url")
    ?? extractAttr(block, "media:content", "url")
    ?? extractAttr(block, "media:thumbnail", "url");
  if (direct) return direct;

  const html = extractTag(block, "content:encoded") ?? extractTag(block, "description");
  if (!html) return null;
  const imageMatch = html.match(/<img[^>]+src=(["'])(https?:\/\/[^"']+)\1/i);
  return imageMatch ? imageMatch[2] : null;
}

function parseFeed(xml: string, source: FeedSource): AdventureNewsItem[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks.map((block, index) => {
    const title = stripHtml(extractTag(block, "title") ?? source.brand);
    const link = stripHtml(extractTag(block, "link") ?? source.url);
    const descriptionRaw = extractTag(block, "description") ?? extractTag(block, "content:encoded") ?? "";
    const summary = stripHtml(descriptionRaw).slice(0, 220) || `Latest update from ${source.brand}.`;
    const publishedAt = stripHtml(extractTag(block, "pubDate") ?? "");

    return {
      id: `${source.id}-${slugify(title || `${source.brand}-${index + 1}`)}`,
      sourceId: source.id,
      brand: source.brand,
      category: source.category,
      title,
      subtitle: source.subtitle,
      summary,
      description: summary,
      ctaLabel: "Read article",
      ctaUrl: link || source.url,
      kind: "brand-news",
      featured: index < 2,
      image: extractImage(block),
      publishedAt: publishedAt || null,
    };
  });
}

function toImageProxyUrl(imageUrl: string | null): string | null {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `/api/adventure-news/image?src=${encodeURIComponent(imageUrl)}`;
}

function sortFeedItems(items: AdventureNewsItem[]): AdventureNewsItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });
}

function dedupeItems(items: AdventureNewsItem[]): AdventureNewsItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = item.ctaUrl || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildSourceFallback(source: FeedSource): AdventureNewsItem {
  return {
    id: `${source.id}-source-fallback`,
    sourceId: source.id,
    brand: source.brand,
    category: source.category,
    title: `${source.brand} source`,
    subtitle: `${source.subtitle} • source temporarily unavailable`,
    summary: `This source was provided for the Adventure News section, but it is currently blocked or unavailable from the local environment.`,
    description: `This source was provided for the Adventure News section, but it is currently blocked or unavailable from the local environment.`,
    ctaLabel: "Open source",
    ctaUrl: source.url,
    kind: "brand-news",
    featured: false,
    image: null,
    publishedAt: null,
  };
}

function mixSources(sourceEntries: Array<{ source: FeedSource; items: AdventureNewsItem[] }>): AdventureNewsItem[] {
  const brandsWithLiveItems = new Set(
    sourceEntries
      .filter(({ items }) => items.length > 0)
      .map(({ source }) => source.brand),
  );
  const queues = shuffleArray(
    sourceEntries.flatMap(({ source, items }) => {
      const deduped = dedupeItems(items);
      const sorted = sortFeedItems(deduped);
      if (sorted.length === 0 && brandsWithLiveItems.has(source.brand)) {
        return [];
      }
      const liveItems = sorted.length > 0 ? sorted : [buildSourceFallback(source)];
      const prioritized = liveItems.length > 1
        ? [...shuffleArray(liveItems.slice(0, Math.min(3, liveItems.length))), ...liveItems.slice(Math.min(3, liveItems.length))]
        : liveItems;
      return [{
        source,
        items: prioritized,
      }];
    }),
  );

  const mixed: AdventureNewsItem[] = [];
  while (mixed.length < MAX_ITEMS) {
    let addedThisRound = false;
    for (const queue of queues) {
      const next = queue.items.shift();
      if (!next) continue;
      mixed.push(next);
      addedThisRound = true;
      if (mixed.length >= MAX_ITEMS) break;
    }
    if (!addedThisRound) break;
  }

  return mixed;
}

async function fetchFeed(source: FeedSource): Promise<AdventureNewsItem[]> {
  const parseIfFeed = (text: string) => (/<rss\b|<feed\b/i.test(text) ? parseFeed(text, source) : []);

  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
        "User-Agent": "Mozilla/5.0 ClipsyReel/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[adventure-news] Feed request failed for ${source.url}: ${response.status}`);
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const parsed = parseIfFeed(text);
    if (parsed.length > 0) return parsed;
  } catch (error) {
    console.warn(`[adventure-news] Feed request failed for ${source.url}:`, error);
  }

  try {
    const { stdout } = await execFileAsync("curl", [
      "--compressed",
      "-L",
      "--max-time",
      "20",
      "-A",
      "Mozilla/5.0 ClipsyReel/1.0",
      source.url,
    ], {
      maxBuffer: 2 * 1024 * 1024,
    });
    return parseIfFeed(stdout);
  } catch (error) {
    console.warn(`[adventure-news] Curl fallback failed for ${source.url}:`, error);
    return [];
  }
}

export async function GET() {
  const sourceEntries = await Promise.all(
    FEED_SOURCES.map(async (source) => ({
      source,
      items: await fetchFeed(source),
    })),
  );
  const items = dedupeItems(mixSources(sourceEntries)).map(({ publishedAt, image, sourceId, ...item }) => ({
    ...item,
    image: toImageProxyUrl(image),
  }));
  return NextResponse.json({ items });
}
