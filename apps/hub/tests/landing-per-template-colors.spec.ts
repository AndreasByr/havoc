import { test, expect } from "@playwright/test";

test("page.put API accepts per-template colorOverrides format", async ({ request }) => {
  const response = await request.put("/api/admin/landing/page", {
    data: {
      activeTemplate: "default",
      colorOverrides: {
        default: { accent: "#ff0000" },
        cyberpunk: { accent: "#00ff00", background: "#111111" },
      },
    },
  });
  // 401/403 = auth required (expected), not 500 = server crash
  expect(response.status()).toBeLessThan(500);
});

test("page.put API accepts empty per-template colorOverrides", async ({ request }) => {
  const response = await request.put("/api/admin/landing/page", {
    data: {
      activeTemplate: "cyberpunk",
      colorOverrides: {},
    },
  });
  expect(response.status()).toBeLessThan(500);
});

test("page.put API accepts per-template overrides for all three templates", async ({ request }) => {
  const response = await request.put("/api/admin/landing/page", {
    data: {
      activeTemplate: "esports",
      colorOverrides: {
        default: { accent: "#7c3aed" },
        cyberpunk: { accent: "#00f0ff", surface: "#0e0e22" },
        esports: { accent: "#e53e3e", background: "#0b0e14" },
      },
    },
  });
  expect(response.status()).toBeLessThan(500);
});

test("settings page loads without server error", async ({ page }) => {
  const response = await page.goto("/landing/settings");
  // Redirects to login (302) or loads — either way, no 500
  expect(response?.status()).toBeLessThan(500);
});

test("editor page loads without server error", async ({ page }) => {
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
});

test("public landing API resolves colors without crash", async ({ request }) => {
  const response = await request.get("/api/public/landing?locale=en");
  // Public endpoint should be accessible
  expect(response.status()).toBeLessThan(500);

  const data = await response.json();
  // Colors should be resolved (either from DB or defaults)
  if (data.colors) {
    expect(data.colors).toHaveProperty("background");
    expect(data.colors).toHaveProperty("accent");
    expect(data.colors).toHaveProperty("surface");
    expect(data.colors).toHaveProperty("text");
    expect(data.colors).toHaveProperty("textMuted");
    expect(data.colors).toHaveProperty("accentText");
    expect(data.colors).toHaveProperty("border");
  }
});
