/**
 * Playwright smoke test for the GUILD-30 landing page implementation.
 *
 * Tests template rendering (default, cyberpunk, esports), CSS variable
 * color system, styleVariant attributes, and block rendering.
 *
 * Requires:
 *   1. Mock hub API on :3003  →  node tests/mock-hub.mjs
 *   2. Nuxt dev server on :3000
 *
 * Run:
 *   PLAYWRIGHT_BROWSERS_PATH=../../.pw-browsers npx playwright test --config playwright.config.ts
 */

import { test, expect } from "@playwright/test";

const MOCK_HUB = "http://localhost:3003";

const TEMPLATE_COLORS = {
  default: {
    background: "#0a0a0a", surface: "#141414", text: "#fafafa",
    textMuted: "#a1a1aa", accent: "#7c3aed", accentText: "#ffffff", border: "#27272a",
  },
  cyberpunk: {
    background: "#0a0a12", surface: "#12122a", text: "#e0e0ff",
    textMuted: "#7a7a9e", accent: "#00f0ff", accentText: "#0a0a12", border: "#1e1e3a",
  },
  esports: {
    background: "#0b0e14", surface: "#131720", text: "#f0f2f5",
    textMuted: "#8a92a0", accent: "#e53e3e", accentText: "#ffffff", border: "#1f2533",
  },
} as const;

type TemplateId = keyof typeof TEMPLATE_COLORS;

async function setTemplate(templateId: TemplateId) {
  await fetch(`${MOCK_HUB}/_test/set-template?id=${templateId}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Landing page smoke test (GUILD-30)", () => {
  for (const templateId of ["default", "cyberpunk", "esports"] as const) {
    test.describe(`Template: ${templateId}`, () => {
      test.beforeEach(async () => {
        await setTemplate(templateId);
      });

      test("page loads without hard errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (err) => errors.push(err.message));

        const response = await page.goto("/");
        expect(response?.status()).toBe(200);
        expect(errors).toEqual([]);
      });

      test("data-template attribute matches template id", async ({ page }) => {
        await page.goto("/");
        const root = page.locator("[data-template]").first();
        await expect(root).toHaveAttribute("data-template", templateId);
      });

      test("CSS color variables are set on root element", async ({ page }) => {
        await page.goto("/");
        const root = page.locator("[data-template]").first();
        const style = await root.getAttribute("style");
        expect(style).toBeTruthy();

        const colors = TEMPLATE_COLORS[templateId];
        expect(style).toContain(`--landing-background:${colors.background}`);
        expect(style).toContain(`--landing-accent:${colors.accent}`);
        expect(style).toContain(`--landing-surface:${colors.surface}`);
        expect(style).toContain(`--landing-text:${colors.text}`);
        expect(style).toContain(`--landing-border:${colors.border}`);
      });

      test("hero block renders heading and subheading", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("h1")).toContainText(`${templateId}-heading`);
        await expect(page.getByText(`${templateId}-subheading`)).toBeVisible();
      });

      test("features block renders title and items", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText(`${templateId}-features-title`)).toBeVisible();
        await expect(page.getByText("Feature A")).toBeVisible();
      });

      test("cta block renders", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText(`${templateId}-cta-heading`)).toBeVisible();
      });

      test("data-style-variant attributes present for normal, accent, warning", async ({ page }) => {
        await page.goto("/");
        const variants = await page.locator("[data-style-variant]").evaluateAll(
          (els) => els.map((el) => el.getAttribute("data-style-variant"))
        );
        expect(variants).toContain("normal");
        expect(variants).toContain("accent");
        expect(variants).toContain("warning");
      });

      test("no unsupported block fallback or Vue errors in DOM", async ({ page }) => {
        await page.goto("/");
        const html = await page.content();
        expect(html).not.toContain("not supported");
        expect(html).not.toContain("Failed to resolve component");
      });
    });
  }

  test("preview mode applies kiosk class", async ({ page }) => {
    await setTemplate("default");
    await page.goto("/?preview=true");
    const root = page.locator(".landing-preview-kiosk");
    await expect(root).toBeVisible();
  });
});
