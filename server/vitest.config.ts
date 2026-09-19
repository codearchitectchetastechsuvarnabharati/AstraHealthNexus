import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/services/datasetLoader.test.ts",
      "src/rateLimit.test.ts",
      "src/services/datasetService.test.ts",
      "src/services/dashboardServiceCoverage.test.ts",
      "src/routes/alertsRoutes.test.ts",
      "src/routes/dashboardRoutes.test.ts",
      "src/routes/telemetryRoutes.test.ts",
      "src/middleware/errorHandler.test.ts"
    ],
    exclude: [
      "dist/**",
      "node_modules/**"
    ]
  }
});
