import type { NextConfig } from "next";

// When deploying to GitHub Pages the app is served from a sub-path
// (https://<user>.github.io/<repo>/). We enable static export and set the
// base path only in that build (BUILD_FOR_PAGES=1), so local `next dev` and
// other hosts keep working at the root.
const isPages = process.env.BUILD_FOR_PAGES === "1";
const repo = process.env.PAGES_BASE_PATH ?? "/ritual-chain-workshop";

const nextConfig: NextConfig = {
  ...(isPages
    ? {
        output: "export",
        basePath: repo,
        assetPrefix: repo,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
