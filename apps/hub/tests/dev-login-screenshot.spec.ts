import { test } from "@playwright/test";

test("screenshot: login page with dev bypass", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/dev-login-page.png", fullPage: true });
});

test("screenshot: dashboard after dev login", async ({ page }) => {
  await page.goto("/api/auth/dev-login?returnTo=/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/dev-login-dashboard.png", fullPage: true });
});
