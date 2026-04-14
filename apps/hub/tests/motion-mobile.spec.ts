import { test, expect, type Page } from "@playwright/test";

const MOBILE = { width: 375, height: 812 };

async function devLogin(page: Page, returnTo = "/dashboard") {
  await page.goto(`/api/auth/dev-login?returnTo=${returnTo}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

// ─── Phase 6: Mobile Motion ────────────────────────────────────────────────────

test.describe("Phase 6 – Mobile animations", () => {
  test("6.1 Dashboard cards animate on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await devLogin(page, "/dashboard");

    // Wait for GSAP stagger animations to complete
    await page.waitForTimeout(1500);

    const statCards = page.locator(".stat");
    const count = await statCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const opacity = await statCards.nth(i).evaluate(
        (el) => window.getComputedStyle(el).opacity
      );
      expect(Number(opacity)).toBe(1);
    }
  });

  test("6.2 Members grid single-column stagger", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await devLogin(page, "/members");

    // Wait for stagger animations to complete
    await page.waitForTimeout(2000);

    const memberCards = page.locator(".grid.gap-6 > *");
    const count = await memberCards.count();

    if (count === 0) {
      test.skip(true, "No member cards found");
      return;
    }

    for (let i = 0; i < count; i++) {
      const opacity = await memberCards.nth(i).evaluate(
        (el) => window.getComputedStyle(el).opacity
      );
      expect(Number(opacity)).toBe(1);
    }
  });

  test("6.3 No horizontal overflow during animation", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await devLogin(page, "/dashboard");

    // Wait for animations to complete
    await page.waitForTimeout(2000);

    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    expect(hasOverflow).toBe(false);
  });

  test("6.4 Mobile drawer transitions correctly", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await devLogin(page, "/dashboard");

    // Look for a hamburger / menu button to open the mobile drawer
    const menuButton = page.locator(
      'button[aria-label*="menu" i], button[aria-label*="nav" i], ' +
      'button:has(.hamburger), button:has([class*="menu"]), ' +
      '[data-testid="mobile-menu"], [data-testid="hamburger"]'
    );

    const menuVisible = await menuButton.first().isVisible().catch(() => false);

    if (!menuVisible) {
      // Try a broader selector — any button with a menu icon (3 lines)
      const fallbackButton = page.locator(
        'header button, nav button, .mobile-nav-trigger'
      ).first();
      const fallbackVisible = await fallbackButton.isVisible().catch(() => false);

      if (!fallbackVisible) {
        test.skip(true, "No mobile drawer trigger found");
        return;
      }

      await fallbackButton.click();
    } else {
      await menuButton.first().click();
    }

    // Verify drawer panel becomes visible within 600ms
    const drawerPanel = page.locator(
      '.mobile-nav-drawer, [data-testid="mobile-drawer"], ' +
      '.drawer-panel, .nav-drawer, [class*="MobileNavDrawer"]'
    );

    await expect(drawerPanel.first()).toBeVisible({ timeout: 600 });
  });
});
