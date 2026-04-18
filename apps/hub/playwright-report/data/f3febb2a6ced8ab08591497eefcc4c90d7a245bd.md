# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audit-auth-guards.spec.ts >> Phase 3.5: Public routes accessible without auth >> /login is accessible and shows login page
- Location: tests/audit-auth-guards.spec.ts:174:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "/login"
Received string:    "http://localhost:3003/setup"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - combobox [ref=e5]:
    - option "English" [selected]
    - option "Deutsch"
  - main [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]:
          - generic [ref=e11]: "1"
          - generic [ref=e12]: Welcome
        - generic [ref=e13]:
          - generic [ref=e15]: "2"
          - generic [ref=e16]: Community
        - generic [ref=e17]:
          - generic [ref=e19]: "3"
          - generic [ref=e20]: Platform
        - generic [ref=e21]:
          - generic [ref=e23]: "4"
          - generic [ref=e24]: Admin
        - generic [ref=e25]:
          - generic [ref=e27]: "5"
          - generic [ref=e28]: Done
      - generic [ref=e32]:
        - heading "Welcome to Guildora Hub" [level=1] [ref=e33]
        - paragraph [ref=e34]: Let's set up your community platform in a few quick steps. You'll configure your community, connect a platform, and create your admin account.
        - button "Get Started" [ref=e36] [cursor=pointer]
```

# Test source

```ts
  80  |     await page.waitForURL("**/login**", { timeout: 15_000 });
  81  | 
  82  |     expect(sawProtectedContent).toBe(false);
  83  |   });
  84  | });
  85  | 
  86  | // ---------------------------------------------------------------------------
  87  | // Phase 3: API endpoints return 401 without session
  88  | // ---------------------------------------------------------------------------
  89  | 
  90  | test.describe("Phase 3: API endpoints return 401 without session", () => {
  91  |   const apiEndpoints = [
  92  |     { method: "GET", path: "/api/dashboard/stats" },
  93  |     { method: "GET", path: "/api/admin/users" },
  94  |     { method: "GET", path: "/api/applications/flows" },
  95  |     { method: "GET", path: "/api/admin/community-settings" },
  96  |   ];
  97  | 
  98  |   for (const endpoint of apiEndpoints) {
  99  |     test(`${endpoint.method} ${endpoint.path} returns 401`, async ({ request }) => {
  100 |       const response = await request.get(endpoint.path);
  101 |       // Should be 401 Unauthorized (not 200, not 500)
  102 |       // Some endpoints may return 403 if session validation order differs
  103 |       expect([401, 403]).toContain(response.status());
  104 |     });
  105 |   }
  106 | });
  107 | 
  108 | // ---------------------------------------------------------------------------
  109 | // Phase 3: Open redirect prevention in login.vue (F-04)
  110 | // ---------------------------------------------------------------------------
  111 | 
  112 | test.describe("Phase 3: Login page rejects protocol-relative returnTo", () => {
  113 |   test("login page normalizes //evil.com to /dashboard", async ({ page }) => {
  114 |     await page.goto("/login?returnTo=%2F%2Fevil.com", { waitUntil: "domcontentloaded" });
  115 |     await page.waitForLoadState("networkidle");
  116 | 
  117 |     // The Discord login link should use /dashboard, not //evil.com
  118 |     const discordLink = page.locator("a.btn-primary");
  119 |     const href = await discordLink.getAttribute("href");
  120 |     expect(href).toBeTruthy();
  121 |     expect(href).toContain("returnTo=%2Fdashboard");
  122 |     expect(href).not.toContain("evil.com");
  123 | 
  124 |     await page.screenshot({
  125 |       path: `${SCREENSHOT_DIR}/guard-login-open-redirect-blocked.png`,
  126 |       fullPage: true,
  127 |     });
  128 |   });
  129 | 
  130 |   test("login page normalizes ///path to /dashboard", async ({ page }) => {
  131 |     await page.goto("/login?returnTo=%2F%2F%2Fpath", { waitUntil: "domcontentloaded" });
  132 |     await page.waitForLoadState("networkidle");
  133 | 
  134 |     const discordLink = page.locator("a.btn-primary");
  135 |     const href = await discordLink.getAttribute("href");
  136 |     expect(href).toContain("returnTo=%2Fdashboard");
  137 |   });
  138 | 
  139 |   test("login page allows valid relative returnTo", async ({ page }) => {
  140 |     await page.goto("/login?returnTo=%2Fmembers", { waitUntil: "domcontentloaded" });
  141 |     await page.waitForLoadState("networkidle");
  142 | 
  143 |     const discordLink = page.locator("a.btn-primary");
  144 |     const href = await discordLink.getAttribute("href");
  145 |     expect(href).toContain("returnTo=%2Fmembers");
  146 |   });
  147 | });
  148 | 
  149 | // ---------------------------------------------------------------------------
  150 | // Phase 3: Members page 404 handling (F-05)
  151 | // ---------------------------------------------------------------------------
  152 | 
  153 | test.describe("Phase 3: Members detail handles non-existent IDs", () => {
  154 |   test("/members/nonexistent-id does not return 500", async ({ page }) => {
  155 |     const response = await page.goto("/members/00000000-0000-0000-0000-000000000000", {
  156 |       waitUntil: "domcontentloaded",
  157 |     });
  158 |     const status = response?.status() || 0;
  159 |     // Should be redirect (301) to /members?member=... or 404 — never 500
  160 |     expect(status).toBeLessThan(500);
  161 | 
  162 |     await page.screenshot({
  163 |       path: `${SCREENSHOT_DIR}/guard-members-nonexistent-id.png`,
  164 |       fullPage: true,
  165 |     });
  166 |   });
  167 | });
  168 | 
  169 | // ---------------------------------------------------------------------------
  170 | // Phase 3.5 -- Public routes work WITHOUT auth
  171 | // ---------------------------------------------------------------------------
  172 | 
  173 | test.describe("Phase 3.5: Public routes accessible without auth", () => {
  174 |   test("/login is accessible and shows login page", async ({ page }) => {
  175 |     const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  176 |     expect(response?.status()).toBeLessThan(400);
  177 | 
  178 |     await page.waitForLoadState("networkidle");
  179 | 
> 180 |     expect(page.url()).toContain("/login");
      |                        ^ Error: expect(received).toContain(expected) // indexOf
  181 | 
  182 |     const body = await page.textContent("body");
  183 |     const hasLoginContent =
  184 |       body?.includes("Login") ||
  185 |       body?.includes("login") ||
  186 |       body?.includes("Discord") ||
  187 |       body?.includes("Development mode") ||
  188 |       body?.includes("Entwicklungsmodus") ||
  189 |       body?.includes("Dev");
  190 |     expect(hasLoginContent).toBe(true);
  191 | 
  192 |     await page.screenshot({
  193 |       path: `${SCREENSHOT_DIR}/public-login.png`,
  194 |       fullPage: true,
  195 |     });
  196 |   });
  197 | 
  198 |   test("/apply/test-flow is accessible (should not 401)", async ({ page }) => {
  199 |     const response = await page.goto("/apply/test-flow", { waitUntil: "domcontentloaded" });
  200 |     const status = response?.status() || 0;
  201 |     expect(status).not.toBe(401);
  202 |     expect(page.url()).not.toContain("/login");
  203 | 
  204 |     await page.screenshot({
  205 |       path: `${SCREENSHOT_DIR}/public-apply-test-flow.png`,
  206 |       fullPage: true,
  207 |     });
  208 |   });
  209 | });
  210 | 
  211 | // ---------------------------------------------------------------------------
  212 | // Phase 4 -- Session Invalidation
  213 | // ---------------------------------------------------------------------------
  214 | 
  215 | test.describe("Phase 4: Session Invalidation", () => {
  216 |   test("login via dev-login, verify session works", async ({ page }) => {
  217 |     await page.goto("/api/auth/dev-login?returnTo=/dashboard");
  218 |     await page.waitForURL("**/dashboard**", { timeout: 15_000 });
  219 | 
  220 |     expect(page.url()).toContain("/dashboard");
  221 |     expect(page.url()).not.toContain("/login");
  222 | 
  223 |     // Access another protected route to confirm session persists
  224 |     await page.goto("/members");
  225 |     await page.waitForLoadState("networkidle");
  226 |     expect(page.url()).toContain("/members");
  227 |     expect(page.url()).not.toContain("/login");
  228 | 
  229 |     await page.screenshot({
  230 |       path: `${SCREENSHOT_DIR}/session-active-members.png`,
  231 |       fullPage: true,
  232 |     });
  233 |   });
  234 | 
  235 |   test("delete session cookie, navigate to protected route -> redirects to /login", async ({
  236 |     page,
  237 |     context,
  238 |   }) => {
  239 |     // Step 1: Login
  240 |     await page.goto("/api/auth/dev-login?returnTo=/dashboard");
  241 |     await page.waitForURL("**/dashboard**", { timeout: 15_000 });
  242 |     expect(page.url()).toContain("/dashboard");
  243 | 
  244 |     // Step 2: Delete all cookies
  245 |     await context.clearCookies();
  246 | 
  247 |     // Step 3: Navigate to a protected route
  248 |     await page.goto("/dashboard");
  249 |     await page.waitForURL("**/login**", { timeout: 15_000 });
  250 | 
  251 |     expect(page.url()).toContain("/login");
  252 | 
  253 |     await page.screenshot({
  254 |       path: `${SCREENSHOT_DIR}/session-invalidated-redirect.png`,
  255 |       fullPage: true,
  256 |     });
  257 |   });
  258 | 
  259 |   test("cleared cookies prevent authenticated API access", async ({
  260 |     request,
  261 |   }) => {
  262 |     // Use Playwright's request context (no cookies) to verify API returns 401
  263 |     // This validates the server-side session check independently of browser state
  264 |     const response = await request.get("/api/dashboard/stats");
  265 |     expect([401, 429]).toContain(response.status());
  266 |   });
  267 | });
  268 | 
```