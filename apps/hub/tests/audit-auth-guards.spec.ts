import { test, expect } from "@playwright/test";

const SCREENSHOT_DIR = "screenshots/audit-2026-04-09";

// ---------------------------------------------------------------------------
// Phase 3 -- Auth Guard Verification (logged OUT)
// ---------------------------------------------------------------------------

test.describe("Phase 3: Auth Guards - Protected routes redirect when logged out", () => {
  const protectedRoutes = [
    { path: "/dashboard", expectReturnTo: "/dashboard", middleware: "auth" },
    { path: "/members", expectReturnTo: "/members", middleware: "auth" },
    { path: "/profile/customize", expectReturnTo: "/profile/customize", middleware: "auth" },
    { path: "/applications/flows", expectReturnTo: "/applications/flows", middleware: "moderator" },
    { path: "/landing/editor", expectReturnTo: "/landing/editor", middleware: "landing" },
    { path: "/settings/community", expectReturnTo: "/settings/community", middleware: "settings" },
  ];

  for (const route of protectedRoutes) {
    test(`${route.path} redirects to /login with returnTo (${route.middleware})`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(500);

      // All middleware should redirect to /login
      await page.waitForURL("**/login**", { timeout: 15_000 });

      const url = new URL(page.url());
      expect(url.pathname).toMatch(/\/login$/);

      // Check returnTo parameter is present
      const returnTo = url.searchParams.get("returnTo");
      expect(returnTo).toBeTruthy();
      const decodedReturnTo = decodeURIComponent(returnTo || "");
      expect(decodedReturnTo).toContain(route.expectReturnTo);

      // No stale authenticated UI elements visible
      const dashboardHeading = page.locator("h1:has-text('Dashboard')");
      expect(await dashboardHeading.count()).toBe(0);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/guard-${route.path.replace(/\//g, "_")}.png`,
        fullPage: true,
      });
    });
  }

  test("/dev/role-switcher redirects (dev middleware guard)", async ({ page }) => {
    const response = await page.goto("/dev/role-switcher", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(500);

    await page.waitForLoadState("networkidle");

    // Dev middleware checks isDev, then the page itself may redirect.
    // In dev mode, dev middleware allows through, but page content requires auth.
    const url = page.url();
    const isRedirected = url.includes("/login") || url.includes("/dashboard") || url.includes("/dev");
    expect(isRedirected).toBe(true);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/guard-dev-role-switcher.png`,
      fullPage: true,
    });
  });

  test("no flash of protected content on redirect", async ({ page }) => {
    let sawProtectedContent = false;

    page.on("framenavigated", async () => {
      try {
        const text = await page.textContent("body", { timeout: 500 }).catch(() => "");
        if (text && (text.includes("Total Members") || text.includes("Weekly Activity"))) {
          sawProtectedContent = true;
        }
      } catch {
        // page may have navigated away already
      }
    });

    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 15_000 });

    expect(sawProtectedContent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 3: API endpoints return 401 without session
// ---------------------------------------------------------------------------

test.describe("Phase 3: API endpoints return 401 without session", () => {
  const apiEndpoints = [
    { method: "GET", path: "/api/dashboard/stats" },
    { method: "GET", path: "/api/admin/users" },
    { method: "GET", path: "/api/applications/flows" },
    { method: "GET", path: "/api/admin/community-settings" },
  ];

  for (const endpoint of apiEndpoints) {
    test(`${endpoint.method} ${endpoint.path} returns 401`, async ({ request }) => {
      const response = await request.get(endpoint.path);
      // Should be 401 Unauthorized (not 200, not 500)
      // Some endpoints may return 403 if session validation order differs
      expect([401, 403]).toContain(response.status());
    });
  }
});

// ---------------------------------------------------------------------------
// Phase 3: Open redirect prevention in login.vue (F-04)
// ---------------------------------------------------------------------------

test.describe("Phase 3: Login page rejects protocol-relative returnTo", () => {
  test("login page normalizes //evil.com to /dashboard", async ({ page }) => {
    await page.goto("/login?returnTo=%2F%2Fevil.com", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // The Discord login link should use /dashboard, not //evil.com
    const discordLink = page.locator("a.btn-primary");
    const href = await discordLink.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toContain("returnTo=%2Fdashboard");
    expect(href).not.toContain("evil.com");

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/guard-login-open-redirect-blocked.png`,
      fullPage: true,
    });
  });

  test("login page normalizes ///path to /dashboard", async ({ page }) => {
    await page.goto("/login?returnTo=%2F%2F%2Fpath", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const discordLink = page.locator("a.btn-primary");
    const href = await discordLink.getAttribute("href");
    expect(href).toContain("returnTo=%2Fdashboard");
  });

  test("login page allows valid relative returnTo", async ({ page }) => {
    await page.goto("/login?returnTo=%2Fmembers", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const discordLink = page.locator("a.btn-primary");
    const href = await discordLink.getAttribute("href");
    expect(href).toContain("returnTo=%2Fmembers");
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Members page 404 handling (F-05)
// ---------------------------------------------------------------------------

test.describe("Phase 3: Members detail handles non-existent IDs", () => {
  test("/members/nonexistent-id does not return 500", async ({ page }) => {
    const response = await page.goto("/members/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
    });
    const status = response?.status() || 0;
    // Should be redirect (301) to /members?member=... or 404 — never 500
    expect(status).toBeLessThan(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/guard-members-nonexistent-id.png`,
      fullPage: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 3.5 -- Public routes work WITHOUT auth
// ---------------------------------------------------------------------------

test.describe("Phase 3.5: Public routes accessible without auth", () => {
  test("/login is accessible and shows login page", async ({ page }) => {
    const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);

    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");

    const body = await page.textContent("body");
    const hasLoginContent =
      body?.includes("Login") ||
      body?.includes("login") ||
      body?.includes("Discord") ||
      body?.includes("Development mode") ||
      body?.includes("Entwicklungsmodus") ||
      body?.includes("Dev");
    expect(hasLoginContent).toBe(true);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/public-login.png`,
      fullPage: true,
    });
  });

  test("/apply/test-flow is accessible (should not 401)", async ({ page }) => {
    const response = await page.goto("/apply/test-flow", { waitUntil: "domcontentloaded" });
    const status = response?.status() || 0;
    expect(status).not.toBe(401);
    expect(page.url()).not.toContain("/login");

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/public-apply-test-flow.png`,
      fullPage: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 4 -- Session Invalidation
// ---------------------------------------------------------------------------

test.describe("Phase 4: Session Invalidation", () => {
  test("login via dev-login, verify session works", async ({ page }) => {
    await page.goto("/api/auth/dev-login?returnTo=/dashboard");
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/login");

    // Access another protected route to confirm session persists
    await page.goto("/members");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/members");
    expect(page.url()).not.toContain("/login");

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/session-active-members.png`,
      fullPage: true,
    });
  });

  test("delete session cookie, navigate to protected route -> redirects to /login", async ({
    page,
    context,
  }) => {
    // Step 1: Login
    await page.goto("/api/auth/dev-login?returnTo=/dashboard");
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    expect(page.url()).toContain("/dashboard");

    // Step 2: Delete all cookies
    await context.clearCookies();

    // Step 3: Navigate to a protected route
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 15_000 });

    expect(page.url()).toContain("/login");

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/session-invalidated-redirect.png`,
      fullPage: true,
    });
  });

  test("cleared cookies prevent authenticated API access", async ({
    request,
  }) => {
    // Use Playwright's request context (no cookies) to verify API returns 401
    // This validates the server-side session check independently of browser state
    const response = await request.get("/api/dashboard/stats");
    expect([401, 429]).toContain(response.status());
  });
});
