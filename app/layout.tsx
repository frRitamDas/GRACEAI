import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/roboto";
// The public page's two faces: a high-contrast serif for headlines and a
// neutral grotesque for everything else. Loaded at the root so the marketing
// route does not pay for a second stylesheet request, and so the fonts are
// already resolved when the page's first paint happens.
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { brandName, tagline } = await getSettings();
  const brand = brandName || "Grace";
  const description = `${brand} is a calm, capable assistant for writing, thinking and building. ${tagline}`;
  const title = `${brand} — ${tagline}`;

  return {
    title: { default: title, template: `%s — ${brand}` },
    description,
    applicationName: brand,
    appleWebApp: { capable: true, title: brand, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false, email: false, address: false },
    manifest: "/manifest.webmanifest",
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description: `One input, five effort levels, one assistant. Ask ${brand}.`,
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-bg antialiased">
      <body className="min-h-full bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
