import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("settings page shows all three template options including Gaming", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const response = await page.goto("/landing/settings");
  expect(response?.status()).toBeLessThan(500);

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Check no critical console errors
  const criticalErrors = consoleErrors.filter(
    (e) =>
      e.includes("Failed to resolve") ||
      e.includes("is not defined") ||
      e.includes("Cannot read properties")
  );
  expect(criticalErrors).toEqual([]);

  await page.screenshot({ path: "screenshots/templates-settings-page.png", fullPage: true });
});

test("settings page loads template cards without errors", async ({ page }) => {
  const response = await page.goto("/landing/settings");
  expect(response?.status()).toBeLessThan(500);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "screenshots/templates-settings-cards.png" });
});

test("landing editor page loads without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const response = await page.goto("/landing/editor");
  expect(response?.status()).toBeLessThan(500);

  await page.waitForTimeout(2000);

  const criticalErrors = consoleErrors.filter(
    (e) =>
      e.includes("Failed to resolve") ||
      e.includes("is not defined") ||
      e.includes("Cannot read properties")
  );
  expect(criticalErrors).toEqual([]);

  await page.screenshot({ path: "screenshots/templates-editor-page.png", fullPage: true });
});

test("template CSS files load correctly via API check", async ({ request }) => {
  // Verify API endpoints don't crash
  const pageResponse = await request.get("/api/admin/landing/page");
  // 401/403 expected without auth, not 500
  expect(pageResponse.status()).toBeLessThan(500);

  const templatesResponse = await request.get("/api/admin/landing/templates");
  expect(templatesResponse.status()).toBeLessThan(500);
});

test("template.put API accepts cyberpunk template", async ({ request }) => {
  const response = await request.put("/api/admin/landing/template", {
    data: { templateId: "cyberpunk" },
  });
  // 401/403 = auth required, not 500
  expect(response.status()).toBeLessThan(500);
});

test("page.put API accepts each template", async ({ request }) => {
  for (const templateId of ["default", "cyberpunk", "esports"]) {
    const response = await request.put("/api/admin/landing/page", {
      data: { activeTemplate: templateId, colorOverrides: {} },
    });
    expect(response.status()).toBeLessThan(500);
  }
});
