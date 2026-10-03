import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Page SQL and the demo snapshot are read from disk at request time, so ship them with the server bundle.
  outputFileTracingIncludes: {
    "/**": ["./sql/**/*", "./data/demo/**/*"],
  },
};

export default nextConfig;
