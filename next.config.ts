import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/song/[id]": ["./data/wordle-words.txt"],
    "/song/[id]/[slug]": ["./data/wordle-words.txt"],
  },
};

export default nextConfig;
