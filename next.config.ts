import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure webpack to avoid bundling issues
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Avoid bundling large/problematic dependencies
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('lightningcss');
      }
    }
    return config;
  },
};

export default nextConfig;
