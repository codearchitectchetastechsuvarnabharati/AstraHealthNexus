import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/services/datasetLoader.test.ts",
      "src/rateLimit.test.ts"
    ],
    exclude: [
      "dist/**",
      "node_modules/**"
    ]
  }
});
