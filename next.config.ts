import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**": ["./data/wordle-words.txt"],
  },
};

export default nextConfig;
