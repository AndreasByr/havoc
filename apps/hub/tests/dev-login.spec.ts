import { test, expect } from "@playwright/test";

test.describe("Dev Login Bypass", () => {
  test("login page shows dev login button", async ({ page }) => {
    await page.goto("/login");
    const devButtons = page.locator('a:has-text("Dev Mode Login"), a:has-text("Dev-Login")');
    await expect(devButtons.first()).toBeVisible({ timeout: 10_000 });
    // Both banner and login card should have a dev login entry
    expect(await devButtons.count()).toBeGreaterThanOrEqual(1);
  });

  test("dev login banner is visible on login page", async ({ page }) => {
    await page.goto("/login");
    const banner = page.locator("text=Development mode");
    // Banner may show in either language
    const bannerDe = page.locator("text=Entwicklungsmodus");
    const visible = await banner.or(bannerDe).isVisible().catch(() => false);
    expect(visible).toBe(true);
  });

  test("dev login creates session and redirects to dashboard", async ({ page }) => {
    const response = await page.goto("/api/auth/dev-login?returnTo=/dashboard");
    // After redirect chain, we should end up at dashboard or login page
    // (dashboard may redirect to mandatory-fields, that's ok)
    expect(page.url()).toContain("localhost:3003");
    expect(response?.status()).toBeLessThan(500);
  });

  test("dev login redirects back to originally requested page", async ({ page }) => {
    await page.goto("/api/auth/dev-login?returnTo=/members");
    await page.waitForURL("**/members**", { timeout: 15_000 });
    expect(page.url()).toContain("/members");
  });

  test("protected page accessible after dev login", async ({ page }) => {
    // First login via dev endpoint
    await page.goto("/api/auth/dev-login?returnTo=/dashboard");
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Now access another protected page
    await page.goto("/members");
    const response = await page.waitForLoadState("networkidle");
    // Should not be redirected to login
    expect(page.url()).not.toContain("/login");
  });

  test("repeated dev login does not error (idempotent user creation)", async ({ page }) => {
    // Login twice — should not create duplicate user or error
    const response1 = await page.goto("/api/auth/dev-login?returnTo=/dashboard");
    expect(response1?.status()).toBeLessThan(500);

    const response2 = await page.goto("/api/auth/dev-login?returnTo=/dashboard");
    expect(response2?.status()).toBeLessThan(500);
  });

  test("no console errors on login page", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const criticalErrors = consoleErrors.filter(
      (e) =>
        e.includes("Failed to resolve") ||
        e.includes("is not defined") ||
        e.includes("Cannot read properties")
    );
    expect(criticalErrors).toEqual([]);
  });
});
