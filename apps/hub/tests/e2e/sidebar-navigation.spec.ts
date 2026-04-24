import { test, expect, type Page } from "@playwright/test";

type RoleKey = "temporary" | "user" | "moderator" | "admin" | "superadmin";

type RouteSpec = {
  path: string;
  requiredRoles: RoleKey[];
};

const rolePriority: RoleKey[] = ["temporary", "user", "moderator", "admin", "superadmin"];

const ALL_ROUTES: RouteSpec[] = [
  { path: "/dashboard", requiredRoles: [] },
  { path: "/profile/customize", requiredRoles: [] },
  { path: "/members", requiredRoles: [] },

  { path: "/landing", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/landing/editor", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/landing/settings", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/landing/footer", requiredRoles: ["moderator", "admin", "superadmin"] },

  { path: "/applications", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/applications/flows", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/applications/open", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/applications/archive", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/applications/config", requiredRoles: ["admin", "superadmin"] },

  { path: "/settings", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/settings/community", requiredRoles: ["admin", "superadmin"] },
  { path: "/settings/custom-fields", requiredRoles: ["admin", "superadmin"] },
  { path: "/settings/permissions", requiredRoles: ["admin", "superadmin"] },
  { path: "/settings/moderation-rights", requiredRoles: ["admin", "superadmin"] },
  { path: "/settings/design", requiredRoles: ["admin", "superadmin"] },
  { path: "/settings/files", requiredRoles: ["superadmin"] },

  { path: "/apps", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/apps/overview", requiredRoles: ["moderator", "admin", "superadmin"] },
  { path: "/apps/sideload", requiredRoles: ["superadmin"] },

  { path: "/dev", requiredRoles: [] },
  { path: "/dev/role-switcher", requiredRoles: [] },
  { path: "/dev/reset", requiredRoles: [] }
];

function hasRoleAccess(route: RouteSpec, role: RoleKey): boolean {
  if (route.requiredRoles.length === 0) return true;
  return route.requiredRoles.includes(role);
}

function roleLabel(role: RoleKey): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

async function devLogin(page: Page, returnTo = "/dashboard") {
  const response = await page.goto(`/api/auth/dev-login?returnTo=${encodeURIComponent(returnTo)}`);
  expect(response?.status() ?? 500).toBeLessThan(500);
  await page.waitForLoadState("networkidle");
}

async function assertMeaningfulPage(page: Page, path: string) {
  await expect(page.locator("nuxt-error-page, #nuxt-error-page")).toHaveCount(0);
  await expect(page.locator("body")).toBeVisible();

  const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  expect(bodyText.length).toBeGreaterThan(40);

  const url = new URL(page.url());
  expect(url.pathname).not.toBe("/login");
  expect(url.pathname).not.toContain("/api/auth");

  if (path === "/settings") {
    expect(url.pathname.startsWith("/settings") || url.pathname.startsWith("/dashboard")).toBeTruthy();
  }
}

async function switchRoleIfPossible(page: Page, role: RoleKey): Promise<boolean> {
  await page.goto("/dev/role-switcher", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const roleFilter = page
    .locator("select")
    .filter({ has: page.locator(`option[value='${role}']`) })
    .first();

  if (await roleFilter.count()) {
    await roleFilter.selectOption(role);
    await page.waitForLoadState("networkidle");
  }

  const switchBtn = page
    .locator("li, [class*='card'], [class*='rounded']")
    .filter({ hasText: roleLabel(role) })
    .locator("button")
    .filter({ hasText: /switch|wechseln/i })
    .first();

  if (!(await switchBtn.count())) {
    return false;
  }

  await switchBtn.click();
  await page.waitForLoadState("networkidle");
  return true;
}

for (const role of rolePriority) {
  test.describe(`sidebar smoke for role ${role}`, () => {
    test(`all sidebar routes for ${role} render without 404/500 or error page`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await devLogin(page, "/dashboard");

      const switched = await switchRoleIfPossible(page, role);
      if (!switched && role !== "superadmin") {
        test.skip(true, `Role ${role} not available in current dev dataset`);
      }

      const relevantRoutes = ALL_ROUTES.filter((route) => hasRoleAccess(route, role));
      for (const route of relevantRoutes) {
        const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
        const status = response?.status() ?? 200;
        expect(status).not.toBe(404);
        expect(status).not.toBeGreaterThanOrEqual(500);

        await page.waitForLoadState("networkidle");
        await assertMeaningfulPage(page, route.path);
      }

      const criticalConsoleErrors = consoleErrors.filter((entry) => {
        const text = entry.toLowerCase();
        return (
          text.includes("cannot read") ||
          text.includes("is not defined") ||
          text.includes("unhandled") ||
          text.includes("nuxt")
        );
      });

      expect(criticalConsoleErrors).toEqual([]);
    });
  });
}

