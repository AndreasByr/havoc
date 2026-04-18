import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@guildora/shared/db/client": resolve(__dirname, "../../packages/shared/src/db/client.ts"),
      "@guildora/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@guildora/app-sdk": resolve(__dirname, "../../packages/app-sdk/src/index.ts"),
    },
  },
});
