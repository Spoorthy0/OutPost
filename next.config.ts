import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // Loaded by Node instead of bundled. It's CommonJS with a dynamic import(); under
  // cacheComponents, webpack's RSC transform adds an ESM import to track that dynamic import,
  // which turns the file into an ES module and breaks its `exports.*` assignments
  // ("ES Modules may not assign module.exports"), crashing /api/agent (pulled in by `ai`).
  serverExternalPackages: ["@vercel/oidc"],
  partialPrefetching: true,
  images: {
    // AVIF first (smallest), WebP as the fallback; the mascot and logo PNGs are ~330 KB originals.
    formats: ["image/avif", "image/webp"],
    // Profile pictures stored from Clerk (User.imageUrl).
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
};

export default nextConfig;
