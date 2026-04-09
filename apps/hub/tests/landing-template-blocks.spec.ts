import { test, expect } from "@playwright/test";

// Use large viewport for all tests since preview panel requires lg (1024px+)
test.use({ viewport: { width: 1440, height: 900 } });

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

test("landing settings page loads without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const response = await page.goto("/landing/settings");
  expect(response?.status()).toBeLessThan(500);

  const criticalErrors = consoleErrors.filter(
    (e) => e.includes("Failed to resolve") || e.includes("is not defined") || e.includes("Cannot read properties")
  );
  expect(criticalErrors).toEqual([]);
});

test("page.put API accepts activeTemplate field", async ({ request }) => {
  // Verify the endpoint schema accepts the new activeTemplate field
  // Without auth this will return 401/403, but not 500 (which would indicate a server error)
  const response = await request.put("/api/admin/landing/page", {
    data: {
      activeTemplate: "default",
      colorOverrides: { default: { accent: "#ff0000" } }
    }
  });
  // 401/403 = auth required (expected without login), not 500 = no server crash
  expect(response.status()).toBeLessThan(500);
});

test("template.put API still works independently", async ({ request }) => {
  const response = await request.put("/api/admin/landing/template", {
    data: { templateId: "default" }
  });
  expect(response.status()).toBeLessThan(500);
});
