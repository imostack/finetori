import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cloudinary URLs are rewritten by this loader into transformation URLs
    // and fetched straight from Cloudinary's CDN, so images never pass through
    // the host's own optimizer or count against its quota. Non-Cloudinary
    // sources fall through unchanged — see lib/cloudinary-loader.ts.
    loader: "custom",
    loaderFile: "./lib/cloudinary-loader.ts",

    // Only consulted for the default loader, but kept so that switching
    // `loader` back to "default" does not immediately break every image with
    // "hostname is not configured".
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
