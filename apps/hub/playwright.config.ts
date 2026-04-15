import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3003";
const port = parseInt(new URL(baseURL).port || "3003", 10);

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx nuxt dev -p ${port} --dotenv ../../.env.local`,
        port,
        timeout: 60_000,
        reuseExistingServer: true,
      },
});
