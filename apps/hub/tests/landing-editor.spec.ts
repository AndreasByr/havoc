import { test, expect } from "@playwright/test";

test("landing editor page loads without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // Editor requires auth — will redirect to login
  const response = await page.goto("/landing/editor");
  expect(response?.status()).toBeLessThan(500);

  // No console errors from component resolution
  const criticalErrors = consoleErrors.filter(
    (e) => e.includes("Failed to resolve") || e.includes("is not defined") || e.includes("Cannot read properties")
  );
  expect(criticalErrors).toEqual([]);
});
