import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@guildora/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@guildora/app-sdk": path.resolve(__dirname, "../../packages/app-sdk/src"),
    },
  },
});
