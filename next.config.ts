import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // z3-solver ships a WASM binary + worker threads — must not be bundled
  serverExternalPackages: ["z3-solver"],
};

export default nextConfig;
