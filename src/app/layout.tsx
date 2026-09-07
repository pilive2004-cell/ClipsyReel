import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { PlanProvider } from "@/lib/plan-context";
import { LocaleProvider } from "@/lib/i18n";

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
      <body className="min-h-full flex flex-col">
        <LocaleProvider>
          <PlanProvider>{children}</PlanProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
