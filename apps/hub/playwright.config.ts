import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3003";
const port = parseInt(new URL(baseURL).port || "3003", 10);
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],
  use: {
    baseURL,
    headless: true,
    trace: isCI ? "retain-on-failure" : "off",
    screenshot: isCI ? "only-on-failure" : "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx nuxt dev -p ${port} --dotenv ../../.env.local`,
        port,
        timeout: 60_000,
        reuseExistingServer: true,
      },
});
