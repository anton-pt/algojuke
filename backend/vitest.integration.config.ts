import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  esbuild: {
    target: "node20",
  },
});
