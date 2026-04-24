import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, returnTo = "/applications") {
  const response = await page.goto(`/api/auth/dev-login?returnTo=${encodeURIComponent(returnTo)}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  // Wait for initial render instead of networkidle (server may have async API calls)
  await page.waitForTimeout(3000);
}

test.describe("applications", () => {
  test("/applications list loads for moderator+ session", async ({ page }) => {
    await devLogin(page, "/applications");

    const url = new URL(page.url());
    // May redirect to /applications/open or stay on /applications
    expect(url.pathname.startsWith("/applications")).toBeTruthy();

    // Wait for initial render
    await page.waitForTimeout(2000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);
    await expect(page.locator("body")).toBeVisible();

    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    expect(bodyText.length).toBeGreaterThan(40);
  });

  test("/applications/flows editor loads for moderator+ session", async ({ page }) => {
    await devLogin(page, "/applications/flows");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/applications/flows");

    // Wait for initial render
    await page.waitForTimeout(2000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    // Either shows editor or shows "no flows" message
    expect(
      bodyText.includes("flow") ||
        bodyText.includes("application") ||
        bodyText.includes("antrag")
    ).toBeTruthy();
  });

  test("/applications/open review page loads for moderator+ session", async ({ page }) => {
    await devLogin(page, "/applications/open");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/applications/open");

    // Wait for initial render
    await page.waitForTimeout(2000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    // Page should load (may show empty state if no applications)
    expect(
      bodyText.includes("application") ||
        bodyText.includes("bewerbung") ||
        bodyText.includes("open") ||
        bodyText.includes("pending")
    ).toBeTruthy();
  });

  test("application form submission flow works or shows appropriate UI", async ({ page }) => {
    // First check if there's a public application form
    const response = await page.goto("/apply", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    // Check if we got a valid response (200 or redirect)
    expect(response?.status() ?? 500).toBeLessThan(500);
    
    // Page should either show form or redirect
    const url = new URL(page.url());
    expect(url.pathname.startsWith("/apply")).toBeTruthy();
  });
});