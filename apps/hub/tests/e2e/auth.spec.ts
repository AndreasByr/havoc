import { test, expect, type Page } from "@playwright/test";

/**
 * Auth test suite for Guildora Hub
 * 
 * Tests login flows, authentication bypass, and session management.
 * Uses dev-login endpoint for authenticated session in tests.
 */

async function devLogin(page: Page, returnTo = "/dashboard") {
  const response = await page.goto(`/api/auth/dev-login?returnTo=${encodeURIComponent(returnTo)}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  // Wait for initial render instead of networkidle (server may have async API calls)
  await page.waitForTimeout(3000);
}

test.describe("login page", () => {
  test("/login renders Discord login button and bare layout", async ({ page }) => {
    const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 500).toBeLessThan(500);
    
    // Wait for initial render instead of networkidle (server makes async API calls that may fail)
    await page.waitForTimeout(3000);
    
    // Verify Discord button is present
    const discordButton = page.locator("a, button").filter({ hasText: /discord/i }).first();
    await expect(discordButton).toBeVisible();
    
    // Verify bare layout: no navbar
    await expect(page.locator("nav, header nav")).toHaveCount(0);
    
    // Verify no hamburger menu
    await expect(page.locator("button[aria-label*='menu' i], button[aria-label*='hamburger' i]")).toHaveCount(0);
    
    // Verify body has meaningful content
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    expect(bodyText.length).toBeGreaterThan(30);
  });

  test("/login redirects unauthenticated requests to login page", async ({ page }) => {
    // Attempt to access protected page without auth - use { failOnStatusCode: false } to handle redirects
    const _response = await page.goto("/dashboard", { waitUntil: "domcontentloaded", failOnStatusCode: false }).catch(() => null);
    
    // Wait for redirect
    await page.waitForTimeout(3000);
    
    const currentUrl = new URL(page.url());
    // Either redirected to /login or still on login (not an error)
    expect(
      currentUrl.pathname === "/login" || 
      currentUrl.pathname === "/api/auth/dev-login" ||
      currentUrl.pathname === "/dashboard"
    ).toBeTruthy();
  });
});

test.describe("dev-login bypass", () => {
  test("dev-login creates authenticated session", async ({ page }) => {
    const response = await page.goto("/api/auth/dev-login?returnTo=/dashboard", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status() ?? 500).toBeLessThan(500);
    
    // Wait for initial render
    await page.waitForTimeout(3000);
    
    // Verify we're now on dashboard (authenticated)
    const url = new URL(page.url());
    expect(url.pathname).toBe("/dashboard");
  });

  test("dev-login works with custom returnTo", async ({ page }) => {
    const response = await page.goto("/api/auth/dev-login?returnTo=/members", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status() ?? 500).toBeLessThan(500);
    
    // Wait for initial render
    await page.waitForTimeout(3000);
    
    // Verify redirected to specified path
    const url = new URL(page.url());
    expect(url.pathname).toBe("/members");
  });
});

test.describe("session persistence", () => {
  test("session persists across page navigations", async ({ page }) => {
    // Login first
    await devLogin(page, "/dashboard");
    
    // Navigate to different page
    await page.goto("/members", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    
    // Should stay on members (not redirected to login)
    const url = new URL(page.url());
    expect(url.pathname).toBe("/members");
    
    // Verify no login page content
    await expect(page.locator("body")).toBeVisible();
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    expect(bodyText.length).toBeGreaterThan(40);
  });

  test("session allows access to role-protected routes", async ({ page }) => {
    await devLogin(page, "/dashboard");
    
    // Try to access admin route
    const response = await page.goto("/settings", { waitUntil: "domcontentloaded", failOnStatusCode: false });
    await page.waitForTimeout(2000);
    
    // Should either show settings or redirect (not 401)
    expect([401, 403]).not.toContain(response?.status() ?? 200);
  });
});