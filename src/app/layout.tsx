import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { PlanProvider } from "@/lib/plan-context";
import { LocaleProvider } from "@/lib/i18n";

const SITE_URL = "https://clipsyreel.netlify.app";
const SITE_NAME = "ClipsyReel";
const SITE_TITLE = "ClipsyReel — Turn videos into scroll-stopping Instagram Reels";
const SITE_DESCRIPTION =
  "Upload your MP4 (and optional GPX route), let AI detect the best moments, apply the Creative Style Engine, and export a ready-to-post 9:16 Instagram Reel with hooks, captions, hashtags and music suggestions — entirely in your browser, no upload to a server.";
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
};

export const metadata: Metadata = {
  title: "ClipsyReel",
  description:
    "Upload your MP4, let AI find the best moments, and export a ready-to-post 9:16 Instagram Reel with hook, caption, hashtags and music suggestions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LocaleProvider>
          <PlanProvider>{children}</PlanProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
