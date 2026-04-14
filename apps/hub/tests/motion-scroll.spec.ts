import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, returnTo = "/dashboard") {
  await page.goto(`/api/auth/dev-login?returnTo=${returnTo}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

// ─── Phase 7: Scroll-triggered Motion ──────────────────────────────────────────

test.describe("Phase 7 – Scroll-triggered animations", () => {
  test("7.1 Above-fold members animate immediately", async ({ page }) => {
    await devLogin(page, "/members");

    // Wait for initial animations to fire
    await page.waitForTimeout(2000);

    const viewportHeight = page.viewportSize()?.height ?? 800;

    const memberCards = page.locator(".grid.gap-6 > *");
    const count = await memberCards.count();

    if (count === 0) {
      test.skip(true, "No member cards found");
      return;
    }

    // Check cards that are within the viewport
    for (let i = 0; i < count; i++) {
      const box = await memberCards.nth(i).boundingBox();
      if (!box || box.y >= viewportHeight) break;

      const opacity = await memberCards.nth(i).evaluate(
        (el) => window.getComputedStyle(el).opacity
      );
      expect(Number(opacity)).toBe(1);
    }
  });

  test("7.2 Below-fold members wait for scroll", async ({ page }) => {
    await devLogin(page, "/members");

    await page.waitForTimeout(2000);

    const viewportHeight = page.viewportSize()?.height ?? 800;
    const memberCards = page.locator(".grid.gap-6 > *");
    const count = await memberCards.count();

    // Find the first card below the fold
    let belowFoldIndex = -1;
    for (let i = 0; i < count; i++) {
      const box = await memberCards.nth(i).boundingBox();
      if (box && box.y >= viewportHeight) {
        belowFoldIndex = i;
        break;
      }
    }

    if (belowFoldIndex === -1) {
      test.skip(true, "All member cards fit in viewport — no below-fold cards");
      return;
    }

    // Below-fold cards should not be animated yet
    const opacityBefore = await memberCards.nth(belowFoldIndex).evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(Number(opacityBefore)).toBeLessThan(1);

    // Scroll the below-fold card into view
    await memberCards.nth(belowFoldIndex).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    // Now it should be animated
    const opacityAfter = await memberCards.nth(belowFoldIndex).evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(Number(opacityAfter)).toBe(1);
  });

  test("7.3 ScrollTrigger.refresh() fires after page transition", async ({
    page,
  }) => {
    await devLogin(page, "/dashboard");

    // Navigate to /members via sidebar link (client-side navigation)
    const membersLink = page.locator(
      'a[href="/members"], a[href*="/members"]'
    ).first();
    await membersLink.click();

    await page.waitForURL("**/members**");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);

    // After page transition with ScrollTrigger.refresh(), cards should animate
    const memberCards = page.locator(".grid.gap-6 > *");
    const count = await memberCards.count();

    if (count === 0) {
      test.skip(true, "No member cards found after navigation");
      return;
    }

    const viewportHeight = page.viewportSize()?.height ?? 800;

    for (let i = 0; i < count; i++) {
      const box = await memberCards.nth(i).boundingBox();
      if (!box || box.y >= viewportHeight) break;

      const opacity = await memberCards.nth(i).evaluate(
        (el) => window.getComputedStyle(el).opacity
      );
      expect(Number(opacity)).toBe(1);
    }
  });

  test("7.4 No orphaned triggers on page leave", async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    await devLogin(page, "/members");
    await page.waitForTimeout(2000);

    // Navigate away to dashboard
    const dashboardLink = page.locator(
      'a[href="/dashboard"], a[href*="/dashboard"]'
    ).first();
    await dashboardLink.click();

    await page.waitForURL("**/dashboard**");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Check for ScrollTrigger-related warnings
    const scrollTriggerWarnings = consoleMessages.filter(
      (msg) =>
        msg.toLowerCase().includes("scrolltrigger") &&
        (msg.toLowerCase().includes("orphan") ||
          msg.toLowerCase().includes("leak") ||
          msg.toLowerCase().includes("killed") ||
          msg.toLowerCase().includes("not found"))
    );

    expect(scrollTriggerWarnings).toHaveLength(0);
  });
});
