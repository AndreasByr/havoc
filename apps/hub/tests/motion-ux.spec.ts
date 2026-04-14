import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, returnTo = "/dashboard") {
  await page.goto(`/api/auth/dev-login?returnTo=${returnTo}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

test.describe("3A: Dashboard Stat Card Stagger", () => {
  test("3.1: Cards reach opacity 1", async ({ page }) => {
    await devLogin(page, "/dashboard");

    await page.waitForFunction(
      () => {
        const cards = document.querySelectorAll(".stat");
        if (cards.length === 0) return false;
        return Array.from(cards).every(
          (card) => getComputedStyle(card).opacity >= "0.99"
        );
      },
      { timeout: 5000 }
    );

    const cards = page.locator(".stat");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("3.2: No layout shift during animation", async ({ page }) => {
    await devLogin(page, "/dashboard");

    // Measure bounding rects immediately
    const initialRects = await page.evaluate(() => {
      const cards = document.querySelectorAll(".stat");
      return Array.from(cards).map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width };
      });
    });

    // Wait 2 seconds for animations to complete
    await page.waitForTimeout(2000);

    const finalRects = await page.evaluate(() => {
      const cards = document.querySelectorAll(".stat");
      return Array.from(cards).map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width };
      });
    });

    expect(initialRects.length).toBeGreaterThan(0);

    for (let i = 0; i < initialRects.length; i++) {
      // No horizontal shift
      expect(Math.abs(finalRects[i].left - initialRects[i].left)).toBeLessThanOrEqual(1);
      // Vertical shift should be at most 12px (the y-distance from gsap.from)
      expect(Math.abs(finalRects[i].top - initialRects[i].top)).toBeLessThanOrEqual(12);
    }
  });

  test("3.3: Cards visible after reload", async ({ page }) => {
    await devLogin(page, "/dashboard");

    // Wait for initial animations
    await page.waitForTimeout(1000);

    // Hard refresh
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.waitForFunction(
      () => {
        const cards = document.querySelectorAll(".stat");
        if (cards.length === 0) return false;
        return Array.from(cards).every(
          (card) => parseFloat(getComputedStyle(card).opacity) >= 0.99
        );
      },
      { timeout: 5000 }
    );
  });
});

test.describe("3B: Members Grid Stagger", () => {
  test("3.4: Member cards reach opacity 1", async ({ page }) => {
    await devLogin(page, "/members");

    await page.waitForFunction(
      () => {
        // Find the members grid container and check its direct children
        const grids = document.querySelectorAll("[data-ref='membersGridRef'], .members-grid");
        // Fallback: look for any grid containing member cards
        let cards: Element[] = [];
        if (grids.length > 0) {
          cards = Array.from(grids[0].children);
        } else {
          // Try broader selector - the grid div containing MemberExpandableCard components
          const allGrids = document.querySelectorAll(".grid");
          for (const grid of allGrids) {
            if (grid.children.length > 2) {
              cards = Array.from(grid.children);
              break;
            }
          }
        }
        if (cards.length === 0) return false;
        return cards.every(
          (card) => parseFloat(getComputedStyle(card).opacity) >= 0.99
        );
      },
      { timeout: 5000 }
    );
  });

  test("3.5: Below-fold cards wait for scroll", async ({ page }) => {
    await devLogin(page, "/members");
    await page.waitForTimeout(1000);

    // Check if there are enough cards that some are below the fold
    const belowFoldInfo = await page.evaluate(() => {
      const grids = document.querySelectorAll("[data-ref='membersGridRef'], .members-grid, .grid");
      let cards: Element[] = [];
      for (const grid of grids) {
        if (grid.children.length > 2) {
          cards = Array.from(grid.children);
          break;
        }
      }
      if (cards.length === 0) return { hasCards: false, hasBelowFold: false };

      const viewportHeight = window.innerHeight;
      const lastCard = cards[cards.length - 1];
      const rect = lastCard.getBoundingClientRect();
      const isBelowFold = rect.top > viewportHeight;
      const lastCardOpacity = parseFloat(getComputedStyle(lastCard).opacity);

      return {
        hasCards: true,
        hasBelowFold: isBelowFold,
        lastCardOpacity,
        totalCards: cards.length,
      };
    });

    if (!belowFoldInfo.hasCards || !belowFoldInfo.hasBelowFold) {
      test.skip();
      return;
    }

    // Last card should have opacity 0 before scrolling (waiting for ScrollTrigger)
    expect(belowFoldInfo.lastCardOpacity).toBeLessThan(0.5);

    // Scroll to the last card
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
    await page.waitForTimeout(1500);

    // After scrolling, last card should be visible
    const afterScrollOpacity = await page.evaluate(() => {
      const grids = document.querySelectorAll("[data-ref='membersGridRef'], .members-grid, .grid");
      let cards: Element[] = [];
      for (const grid of grids) {
        if (grid.children.length > 2) {
          cards = Array.from(grid.children);
          break;
        }
      }
      if (cards.length === 0) return 0;
      const lastCard = cards[cards.length - 1];
      return parseFloat(getComputedStyle(lastCard).opacity);
    });

    expect(afterScrollOpacity).toBeGreaterThanOrEqual(0.99);
  });
});

test.describe("3C: Page Transitions", () => {
  test("3.6: Dashboard to Members via sidebar click", async ({ page }) => {
    await devLogin(page, "/dashboard");

    // Click sidebar link to members
    const membersLink = page.locator('a[href*="/members"]').first();
    await membersLink.click();

    // Verify members page renders within 500ms
    const membersHeading = page.locator("h1, h2").filter({ hasText: /members|mitglieder/i });
    await expect(membersHeading.first()).toBeVisible({ timeout: 500 });
  });

  test("3.7: No flash of unstyled content", async ({ page }) => {
    await devLogin(page, "/dashboard");

    // Set up opacity tracking during navigation
    const opacityValues: number[] = [];
    await page.evaluate(() => {
      (window as any).__opacityLog = [];
      const observer = new MutationObserver(() => {
        const main = document.querySelector("main") || document.querySelector("[class*='page']");
        if (main) {
          (window as any).__opacityLog.push(parseFloat(getComputedStyle(main).opacity));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      (window as any).__opacityObserver = observer;
    });

    // Navigate to members
    const membersLink = page.locator('a[href*="/members"]').first();
    await membersLink.click();
    await page.waitForTimeout(500);

    const log = await page.evaluate(() => {
      (window as any).__opacityObserver?.disconnect();
      return (window as any).__opacityLog as number[];
    });

    // During transition, opacity should go through a low value (leave animation)
    // This confirms content doesn't just flash at full opacity then re-animate
    if (log.length > 2) {
      const hasTransition = log.some((v) => v < 0.9);
      expect(hasTransition).toBe(true);
    }
  });

  test("3.8: Login to Dashboard transition", async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await devLogin(page, "/dashboard");

    // Verify dashboard content is visible
    await page.waitForLoadState("networkidle");
    const dashboardContent = page.locator("main, [class*='dashboard']").first();
    await expect(dashboardContent).toBeVisible({ timeout: 5000 });

    // No console errors during transition
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("404")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
