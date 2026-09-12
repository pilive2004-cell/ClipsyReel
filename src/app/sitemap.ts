import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

/** Static sitemap.xml — the app is currently a single-page tool (no separate routes), but this keeps the file in place so it's a one-line addition once more pages (e.g. a blog or docs) exist. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${getSiteUrl()}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
