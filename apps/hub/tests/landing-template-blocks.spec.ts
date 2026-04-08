import { test, expect } from "@playwright/test";

// Use large viewport for all tests since preview panel requires lg (1024px+)
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Landing Page Template & Block Rendering", () => {
  test.beforeEach(async ({ page }) => {
    // Dev bypass login
    await page.goto("/api/auth/discord?returnTo=/landing/editor");
    await page.waitForURL("**/landing/editor");

    // Dismiss onboarding tour if present
    const tourOverlay = page.locator(".tour-overlay");
    if (await tourOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.evaluate(() => {
        const skip = document.querySelector(".tour-tooltip__skip") as HTMLElement;
        if (skip) skip.click();
      });
      await page.waitForTimeout(500);
    }
  });

  test("preview renders blocks without 'unsupported' fallback", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });

    // Open inline preview
    const previewToggle = page.locator("button", { hasText: /preview/i }).first();
    await expect(previewToggle).toBeVisible({ timeout: 5_000 });
    await previewToggle.click({ force: true });
    await page.waitForTimeout(2000);

    // Verify preview container exists with a data-template attribute
    const previewContainer = page.locator("[data-template]");
    await expect(previewContainer.first()).toBeVisible({ timeout: 5_000 });

    // Check no "unsupported" / "nicht unterstützt" fallback text in preview
    const unsupportedBlocks = page.locator("[data-template] >> text=/unsupported|nicht unterstützt/i");
    expect(await unsupportedBlocks.count()).toBe(0);

    // No critical console errors about component resolution
    const criticalErrors = consoleErrors.filter(
      (e) => e.includes("Failed to resolve") || e.includes("is not defined")
    );
    expect(criticalErrors).toEqual([]);

    await page.screenshot({ path: "screenshots/landing-preview-blocks.png", fullPage: true });
  });

  test("template switch on settings page works", async ({ page }) => {
    await page.goto("/landing/settings");
    await page.waitForLoadState("networkidle");

    const templateGrid = page.locator(".grid button").first();
    await expect(templateGrid).toBeVisible({ timeout: 10_000 });

    // Find and click cyberpunk template
    const cyberpunkCard = page.locator("button", { hasText: /cyberpunk/i });
    if (await cyberpunkCard.isVisible()) {
      await cyberpunkCard.click();
      await page.waitForTimeout(500);

      // Verify the "Published" badge appears on cyberpunk card
      const publishedBadge = cyberpunkCard.locator("text=/published|veröffentlicht/i");
      await expect(publishedBadge).toBeVisible({ timeout: 5_000 });

      // Verify cyberpunk card has accent border
      const style = await cyberpunkCard.getAttribute("style");
      expect(style).toContain("box-shadow");
    }
  });
});
