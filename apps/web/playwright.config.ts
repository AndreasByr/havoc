import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npx nuxt dev -p 3000 --dotenv ../../.env",
    port: 3000,
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
