import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_IGNORE_TYPE_ERRORS === "true",
  },
  images: {
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
