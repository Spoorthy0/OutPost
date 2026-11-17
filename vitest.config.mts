import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // jsdom for the tests that run a headless tldraw editor; the pure-logic ones don't mind.
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    coverage: {
      include: ["lib/**", "components/EntityTable/**"],
      exclude: ["lib/generated/**"],
    },
  },
});
