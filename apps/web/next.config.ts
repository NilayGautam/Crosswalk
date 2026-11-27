import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const apiOrigin = process.env.CROSSWALK_API_ORIGIN ?? "http://localhost:8787";

const config: NextConfig = {
  // The built app is plain static files, served by the API server.
  output: isDev ? undefined : "export",
  trailingSlash: true,
  reactStrictMode: true,
  transpilePackages: ["@crosswalk/contract"],
  images: { unoptimized: true },
  // In development the web app runs on its own port and forwards API calls,
  // so the browser still sees one origin.
  rewrites: isDev
    ? async () => [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
    : undefined,
  skipTrailingSlashRedirect: true,
};

export default config;
