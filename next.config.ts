import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Railway mounts .next/cache as a persistent volume. Reusing webpack's
  // filesystem cache across deploys once shipped a stale React client-reference
  // manifest — a conditionally-rendered client component (MissedDayBanner) was
  // missing from it, so the dashboard 500'd only for users who hit that branch.
  // We can't delete the mounted cache (EBUSY), so disable the build cache for
  // production builds to force a consistent, from-scratch compile every deploy.
  webpack: (config, { dev }) => {
    if (!dev) config.cache = false;
    return config;
  },
  // Never let the service-worker script itself be HTTP-cached. iOS can otherwise
  // hold a stale /sw.js for up to 24h, delaying the update that pulls new code.
  // Revalidating on every request means a bumped APP_VERSION reaches users fast.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
