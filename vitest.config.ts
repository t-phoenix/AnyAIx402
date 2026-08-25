import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/__tests__/**/*.test.ts",
      "apps/**/src/__tests__/**/*.test.ts",
      "agents/**/__tests__/**/*.test.ts",
    ],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@anyx/config": path.resolve(__dirname, "packages/config/src/index.ts"),
      "@anyx/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@anyx/sdk": path.resolve(__dirname, "packages/sdk/src/index.ts"),
      "@anyx/db": path.resolve(__dirname, "packages/db/src/index.ts"),
    },
  },
});
