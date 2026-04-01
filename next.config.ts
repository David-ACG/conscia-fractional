import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
