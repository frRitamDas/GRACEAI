import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { brandName, tagline } = await getSettings();
  const brand = brandName || "GRACE AI";
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
