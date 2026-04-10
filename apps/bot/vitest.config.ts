import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
  resolve: {
    alias: {
      "@guildora/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@guildora/app-sdk": resolve(__dirname, "../../packages/app-sdk/src/index.ts"),
    },
  },
});
