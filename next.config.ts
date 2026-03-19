import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Prevent Turbopack from bundling these CJS image-decoding packages.
  // They're used only in server-side API routes and work fine when required at runtime.
  serverExternalPackages: ["jpeg-js", "pngjs"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
