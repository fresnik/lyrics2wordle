import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // Outside Next.js's build, "server-only" has no bundler condition to pick
      // its no-op export, so its default export throws unconditionally. Point
      // it at the package's own no-op module (the same one Next.js resolves to
      // via the "react-server" condition) so server-only code is testable here.
      "server-only": path.resolve(
        __dirname,
        "node_modules/server-only/empty.js"
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
