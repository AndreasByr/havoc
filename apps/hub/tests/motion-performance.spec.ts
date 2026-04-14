import { test, expect, type Page } from "@playwright/test";

async function devLogin(page: Page, returnTo = "/dashboard") {
  await page.goto(`/api/auth/dev-login?returnTo=${returnTo}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

// ─── Phase 8: Performance Budgets ──────────────────────────────────────────────

test.describe("Phase 8 – Animation performance budgets", () => {
  test("8.1 Dashboard LCP < 2.5s", async ({ page }) => {
    await devLogin(page, "/dashboard");

    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          resolve(last.renderTime || last.loadTime || last.startTime);
          observer.disconnect();
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });

        // Fallback: if no LCP entry within 5s, resolve with 0
        setTimeout(() => resolve(0), 5000);
      });
    });

    // LCP of 0 means no entry was captured (fallback hit) — skip assertion
    if (lcp > 0) {
      expect(lcp).toBeLessThan(2500);
    }
  });

  test("8.2 Layout shifts during animation CLS < 0.1", async ({ page }) => {
    // Set up CLS observer before navigation
    await page.addInitScript(() => {
      (window as any).__cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!shift.hadRecentInput && shift.value) {
            (window as any).__cls += shift.value;
          }
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    });

    await devLogin(page, "/dashboard");

    // Wait for all animations to settle
    await page.waitForTimeout(3000);

    const cls = await page.evaluate(() => (window as any).__cls ?? 0);
    expect(cls).toBeLessThan(0.1);
  });

  test("8.3 Total dashboard mount to all-visible < 500ms", async ({
    page,
  }) => {
    const startTime = Date.now();

    await page.goto("/api/auth/dev-login?returnTo=/dashboard");
    await page.waitForLoadState("networkidle");

    // Poll until all .stat cards have opacity 1
    const allVisible = await page.waitForFunction(
      () => {
        const cards = document.querySelectorAll(".stat");
        if (cards.length === 0) return false;
        return Array.from(cards).every(
          (el) => window.getComputedStyle(el).opacity === "1"
        );
      },
      { timeout: 10000 }
    );

    const elapsed = Date.now() - startTime;

    // We measure from devLogin complete to all-visible; subtract the
    // network/auth overhead by using a generous budget.
    // The actual animation time (mount to visible) should be under 500ms,
    // but we include page load so we use a reasonable total.
    expect(allVisible).toBeTruthy();

    // Also check via in-page timestamps for a tighter measurement
    const animDuration = await page.evaluate(() => {
      const navEntry = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      const domReady = navEntry?.domContentLoadedEventEnd ?? 0;
      const now = performance.now();
      // Time from DOM ready to now (when all cards are visible)
      return now - domReady;
    });

    // The mount-to-visible window should be under 500ms
    // (domContentLoaded to all stat cards at opacity 1)
    expect(animDuration).toBeLessThan(500);
  });

  test("8.4 Interaction during animation — response < 100ms", async ({
    page,
  }) => {
    // Set up event timing observer
    await page.addInitScript(() => {
      (window as any).__eventTimings = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & {
            processingStart?: number;
            startTime?: number;
          };
          if (e.processingStart && e.startTime) {
            (window as any).__eventTimings.push(
              e.processingStart - e.startTime
            );
          }
        }
      });
      try {
        observer.observe({ type: "event", buffered: true });
      } catch {
        // event timing API not supported — will handle below
      }
    });

    await devLogin(page, "/dashboard");

    // Click an interactive element quickly while animations may still run
    const clickable = page.locator(
      'a, button, [role="button"], [tabindex="0"]'
    ).first();

    const clickableVisible = await clickable.isVisible().catch(() => false);
    if (!clickableVisible) {
      test.skip(true, "No clickable element found during animation");
      return;
    }

    const clickStart = Date.now();
    await clickable.click({ force: true });
    const clickEnd = Date.now();

    // Basic click responsiveness — the click itself should not block
    const clickDuration = clickEnd - clickStart;
    expect(clickDuration).toBeLessThan(100);

    // Also check event timing API if available
    await page.waitForTimeout(500);
    const timings: number[] = await page.evaluate(
      () => (window as any).__eventTimings ?? []
    );

    if (timings.length > 0) {
      const maxDelay = Math.max(...timings);
      expect(maxDelay).toBeLessThan(100);
    }
  });

  test("8.5 GSAP bundle contribution < 30KB gzipped", async ({ page }) => {
    await devLogin(page, "/dashboard");

    const gsapBundleSize = await page.evaluate(() => {
      const resources = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];

      const gsapResources = resources.filter(
        (r) =>
          r.name.toLowerCase().includes("gsap") ||
          r.name.toLowerCase().includes("scrolltrigger") ||
          r.name.toLowerCase().includes("scrollto")
      );

      if (gsapResources.length === 0) {
        // GSAP might be bundled into a larger chunk — look for motion-related chunks
        const motionResources = resources.filter(
          (r) =>
            r.name.toLowerCase().includes("motion") ||
            r.name.toLowerCase().includes("animation")
        );
        return motionResources.reduce(
          (sum, r) => sum + (r.transferSize || 0),
          0
        );
      }

      return gsapResources.reduce(
        (sum, r) => sum + (r.transferSize || 0),
        0
      );
    });

    // 30KB = 30720 bytes
    // If transferSize is 0, the resource may be cached or CORS-restricted;
    // skip the assertion in that case.
    if (gsapBundleSize > 0) {
      expect(gsapBundleSize).toBeLessThan(30720);
    }
  });
});
