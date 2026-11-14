import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/roboto";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grace — an AI that keeps things clear",
  description:
    "Grace is a calm AI assistant for building, writing and thinking. Pick an effort level, choose a frontier model, and go.",
  applicationName: "Grace",
  appleWebApp: { capable: true, title: "Grace", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Grace — an AI that keeps things clear",
    description:
      "Five effort levels, one input, every frontier model. Ask Grace.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full bg-black antialiased">
      <body className="min-h-full bg-black font-sans text-white">{children}</body>
    </html>
  );
}
