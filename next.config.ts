import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/render/image/public/**",
            },
          ]
        : []),
    ],
  },
  async redirects() {
    // Legacy singular path from before route naming was standardized to the
    // plural `/families/:id`. Keep a temporary 307 so older invite links and
    // bookmarks still land. Safe to remove after one release.
    return [
      {
        source: "/family/:id",
        destination: "/families/:id",
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
