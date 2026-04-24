import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, returnTo = "/settings") {
  const response = await page.goto(`/api/auth/dev-login?returnTo=${encodeURIComponent(returnTo)}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  // Wait for initial render instead of networkidle (server may have async API calls)
  await page.waitForTimeout(3000);
}

test.describe("settings", () => {
  test("/settings (general) loads for authenticated user", async ({ page }) => {
    await devLogin(page, "/settings");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/settings");

    // Wait for initial render
    await page.waitForTimeout(2000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);
    await expect(page.locator("body")).toBeVisible();

    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    expect(bodyText.length).toBeGreaterThan(60);
  });

  test("/settings/appearance loads and shows appearance/theme related controls", async ({ page }) => {
    await devLogin(page, "/settings/appearance");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/settings/appearance");

    // Wait for initial render
    await page.waitForTimeout(2000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(
      bodyText.includes("appearance") ||
        bodyText.includes("design") ||
        bodyText.includes("theme") ||
        bodyText.includes("darstellung") ||
        bodyText.includes("design")
    ).toBeTruthy();
  });

  test("/settings/community loads for admin-level session", async ({ page }) => {
    await devLogin(page, "/settings/community");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/settings/community");

    // Wait for initial render
    await page.waitForTimeout(2000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(
      bodyText.includes("community") ||
        bodyText.includes("guild") ||
        bodyText.includes("server") ||
        bodyText.includes("gemeinschaft")
    ).toBeTruthy();
  });

  test("permission settings route is accessible for superadmin-level dev session", async ({ page }) => {
    await devLogin(page, "/settings/permissions");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/settings/permissions");

    // Wait for initial render
    await page.waitForTimeout(2000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    expect(
      bodyText.includes("permission") ||
        bodyText.includes("role") ||
        bodyText.includes("berecht") ||
        bodyText.includes("rolle")
    ).toBeTruthy();
  });
});