import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Keep screenshots and the product surface clean in development.
  devIndicators: false,
  // The live preview proxies the dev server through an e2b host, so allow it.
  allowedDevOrigins: ["**.e2b.app"],
  experimental: {
    serverActions: {
      allowedOrigins: ["**.e2b.app"],
    },
  },
};

export default nextConfig;
