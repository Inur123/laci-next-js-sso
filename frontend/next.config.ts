import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true, // Enable gzip/brotli compression

  //  IMAGE OPTIMIZATION
  images: {
    formats: ["image/avif", "image/webp"], // Modern formats first
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache

    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth avatars
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },

    //  OPTIMIZED PACKAGE IMPORTS - Reduce bundle size
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-tooltip",
      "recharts",
    ],

    //  ENABLE PARTIAL PRERENDERING (Next.js 14+)
    // ppr: 'incremental', // Uncomment when stable
  },

  //  OPTIMIZE PRODUCTION BUILD
  poweredByHeader: false, // Remove X-Powered-By header
  reactStrictMode: false,

  //  COMPILER OPTIMIZATIONS



  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
};

export default nextConfig;
