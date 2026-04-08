import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3003",
    headless: true,
  },
  webServer: {
    command: "npx nuxt dev -p 3003 --dotenv ../../.env.local",
    port: 3003,
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
