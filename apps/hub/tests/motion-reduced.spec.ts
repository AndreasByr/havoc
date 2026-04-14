import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, returnTo = "/dashboard") {
  await page.goto(`/api/auth/dev-login?returnTo=${returnTo}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

test.describe("Phase 4: Reduced Motion", () => {
  test("4.1: Dashboard cards appear instantly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await devLogin(page, "/dashboard");

    // Cards should be at full opacity almost immediately (no animation delay)
    await page.waitForFunction(
      () => {
        const cards = document.querySelectorAll(".stat");
        if (cards.length === 0) return false;
        return Array.from(cards).every(
          (card) => parseFloat(getComputedStyle(card).opacity) >= 0.99
        );
      },
      { timeout: 100 }
    );
  });

  test("4.2: Page transitions are instant", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await devLogin(page, "/dashboard");

    // Click sidebar link to members
    const membersLink = page.locator('a[href*="/members"]').first();
    await membersLink.click();

    // Target page should be visible immediately (within 200ms), no intermediate opacity states
    const membersHeading = page.locator("h1, h2").filter({ hasText: /members|mitglieder/i });
    await expect(membersHeading.first()).toBeVisible({ timeout: 200 });
  });

  test("4.3: Members grid appears instantly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await devLogin(page, "/members");

    // All member cards should be visible immediately
    await page.waitForFunction(
      () => {
        const grids = document.querySelectorAll("[data-ref='membersGridRef'], .members-grid, .grid");
        let cards: Element[] = [];
        for (const grid of grids) {
          if (grid.children.length > 2) {
            cards = Array.from(grid.children);
            break;
          }
        }
        if (cards.length === 0) return false;
        return cards.every(
          (card) => parseFloat(getComputedStyle(card).opacity) >= 0.99
        );
      },
      { timeout: 100 }
    );
  });

  test("4.4: No GSAP animation calls", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Inject spy before any page scripts run
    await page.addInitScript(() => {
      (window as any).__gsapAnimCalls = 0;

      // Wait for gsap to be available and then monkey-patch
      const patchGsap = () => {
        const gsap = (window as any).gsap;
        if (!gsap) return;

        const originalFrom = gsap.from.bind(gsap);
        const originalTo = gsap.to.bind(gsap);

        gsap.from = (...args: any[]) => {
          (window as any).__gsapAnimCalls++;
          return originalFrom(...args);
        };

        gsap.to = (...args: any[]) => {
          (window as any).__gsapAnimCalls++;
          return originalTo(...args);
        };

        // gsap.set is allowed and should NOT be counted
      };

      // Patch immediately if gsap exists, otherwise watch for it
      if ((window as any).gsap) {
        patchGsap();
      } else {
        Object.defineProperty(window, "gsap", {
          configurable: true,
          set(val) {
            Object.defineProperty(window, "gsap", {
              value: val,
              writable: true,
              configurable: true,
            });
            patchGsap();
          },
          get() {
            return undefined;
          },
        });
      }
    });

    await devLogin(page, "/dashboard");
    await page.waitForTimeout(1000);

    const animCalls = await page.evaluate(() => (window as any).__gsapAnimCalls);
    expect(animCalls).toBe(0);
  });

  test("4.5: CSS transitions still work", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await devLogin(page, "/dashboard");

    // Check that button elements still have CSS transition properties
    const hasTransition = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button, a.btn, [class*='btn']");
      for (const btn of buttons) {
        const style = getComputedStyle(btn);
        const transition = style.transitionProperty || style.transition;
        if (transition && transition !== "none" && transition !== "all 0s ease 0s") {
          return true;
        }
      }
      return false;
    });

    expect(hasTransition).toBe(true);
  });
});
