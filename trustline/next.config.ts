import type { NextConfig } from "next";

// The face-check library's package points Node builds at a native TensorFlow add-on.
// It only ever runs in the browser, so always use its self-contained browser bundle.
const HUMAN_BROWSER = "./node_modules/@vladmandic/human/dist/human.esm.js";

const nextConfig: NextConfig = {
  // Native SQLite driver and mail libraries: load them from node_modules at runtime instead of bundling them.
  serverExternalPackages: ["better-sqlite3", "mailauth", "mailparser"],
  turbopack: { resolveAlias: { "@vladmandic/human": HUMAN_BROWSER } },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@vladmandic/human$": require.resolve(HUMAN_BROWSER) };
    return config;
  },
};

export default nextConfig;
