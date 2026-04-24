import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, returnTo = "/dashboard") {
  const response = await page.goto(`/api/auth/dev-login?returnTo=${encodeURIComponent(returnTo)}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  // Wait for initial render instead of networkidle (server may have async API calls)
  await page.waitForTimeout(3000);
}

test.describe("dashboard", () => {
  test("/dashboard page loads after login", async ({ page }) => {
    await devLogin(page, "/dashboard");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/dashboard");

    // Wait for initial render instead of networkidle
    await page.waitForTimeout(3000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);
    await expect(page.locator("body")).toBeVisible();

    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    expect(bodyText.length).toBeGreaterThan(80);
  });

  test("dashboard shows user greeting or profile avatar context", async ({ page }) => {
    await devLogin(page, "/dashboard");

    // Wait for initial render
    await page.waitForTimeout(3000);

    const greetingCandidates = page
      .locator("h1, h2, [data-testid*='greeting'], [class*='welcome' i]")
      .filter({ hasText: /hallo|hello|welcome|moin|servus/i });

    const avatarCandidates = page.locator(
      "img[alt*='avatar' i], img[alt*='profil' i], [data-testid*='avatar'], [class*='avatar' i]"
    );

    const hasGreeting = (await greetingCandidates.count()) > 0;
    const hasAvatar = (await avatarCandidates.count()) > 0;

    expect(hasGreeting || hasAvatar).toBeTruthy();
  });

  test("core dashboard widgets render without critical runtime errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await devLogin(page, "/dashboard");

    // Wait for initial render
    await page.waitForTimeout(3000);

    await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);

    const widgetCandidates = page.locator(
      "main section, main [class*='card' i], main [class*='widget' i], main [class*='panel' i]"
    );
    expect(await widgetCandidates.count()).toBeGreaterThan(0);

    const criticalConsoleErrors = consoleErrors.filter((entry) => {
      const text = entry.toLowerCase();
      return (
        text.includes("cannot read") ||
        text.includes("is not defined") ||
        text.includes("unhandled") ||
        text.includes("failed to fetch") ||
        text.includes("nuxt")
      );
    });

    expect(criticalConsoleErrors).toEqual([]);
  });
});