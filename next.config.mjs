import path from "path";
import { fileURLToPath } from "url";

// Pin the workspace root to this project. Without this, Next's monorepo
// auto-detection walks up from here, finds an unrelated package.json at
// /Users/boragungor/package.json (a stray dependency for a different
// project — see the workspace CLAUDE.md), and treats THAT as the root.
// That silently changes where `output: "standalone"` places server.js
// (nested under an extra "redis-gui/" folder instead of at the top level),
// breaking `node .next/standalone/server.js` and any tooling that assumes
// the documented standalone layout.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig
