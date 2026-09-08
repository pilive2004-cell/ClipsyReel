import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/** Static robots.txt — generated at build time (works with `output: "export"` since this is a single fixed file, no dynamic params). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://clipsyreel.netlify.app/sitemap.xml",
  };
}
