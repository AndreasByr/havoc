import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

async function devLogin(page: Page, returnTo = "/dashboard") {
  await page.goto(`/api/auth/dev-login?returnTo=${returnTo}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

test.describe("Phase 5: SSR Safety", () => {
  test("5.1: No hydration mismatch warnings", async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    await devLogin(page, "/dashboard");
    await page.waitForTimeout(2000);

    const hydrationWarnings = consoleMessages.filter((msg) =>
      msg.includes("[Vue warn]: Hydration")
    );
    expect(hydrationWarnings).toHaveLength(0);
  });

  test("5.2: No inline animation styles in SSR HTML", async ({ browser }) => {
    // Fetch the page with JavaScript disabled to see raw SSR HTML
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    // Go directly to dashboard (won't have auth but we can check the HTML structure)
    // Use dev-login first in a JS-enabled context to get cookies
    const authContext = await browser.newContext();
    const authPage = await authContext.newPage();
    await devLogin(authPage, "/dashboard");

    // Get cookies from authenticated session
    const cookies = await authContext.cookies();
    await authContext.close();

    // Apply cookies to the JS-disabled context
    await context.addCookies(cookies);

    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Check that stat cards don't have inline opacity: 0 or transform styles in SSR HTML
    const hasInlineAnimStyles = await page.evaluate(() => {
      const stats = document.querySelectorAll(".stat");
      for (const stat of stats) {
        const style = stat.getAttribute("style") || "";
        if (style.includes("opacity: 0") || style.includes("opacity:0")) {
          return true;
        }
        if (style.includes("transform") && style.includes("translate")) {
          return true;
        }
      }
      return false;
    });

    expect(hasInlineAnimStyles).toBe(false);
    await context.close();
  });

  test("5.3: No ScrollTrigger errors on load", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await devLogin(page, "/dashboard");
    await page.waitForTimeout(2000);

    const scrollTriggerErrors = consoleErrors.filter((msg) =>
      msg.toLowerCase().includes("scrolltrigger")
    );
    expect(scrollTriggerErrors).toHaveLength(0);
  });

  test("5.4: gsap.client.ts is client-only", () => {
    // Verify the GSAP plugin follows the .client.ts naming convention
    // so Nuxt only loads it on the client side
    const pluginsDir = path.resolve(__dirname, "../app/plugins");
    const gsapPluginPath = path.join(pluginsDir, "gsap.client.ts");

    expect(fs.existsSync(gsapPluginPath)).toBe(true);

    // Also verify no server-side gsap plugin exists
    const gsapServerPlugin = path.join(pluginsDir, "gsap.server.ts");
    const gsapUniversalPlugin = path.join(pluginsDir, "gsap.ts");

    expect(fs.existsSync(gsapServerPlugin)).toBe(false);
    expect(fs.existsSync(gsapUniversalPlugin)).toBe(false);
  });
});
