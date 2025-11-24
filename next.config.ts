import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '/swagger2jmeter',
  assetPrefix: '/swagger2jmeter/',
};

export default nextConfig;
