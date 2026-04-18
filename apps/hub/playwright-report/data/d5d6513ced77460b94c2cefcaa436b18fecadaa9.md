# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: motion-ux.spec.ts >> 3A: Dashboard Stat Card Stagger >> 3.1: Cards reach opacity 1
- Location: tests/motion-ux.spec.ts:10:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "404" [level=1] [ref=e5]
  - paragraph [ref=e6]: Not Found
  - button "Back to Dashboard" [ref=e7] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | 
  3   | async function devLogin(page: Page, returnTo = "/dashboard") {
  4   |   await page.goto(`/api/auth/dev-login?returnTo=${returnTo}`);
  5   |   await page.waitForLoadState("networkidle");
  6   |   await page.waitForTimeout(2000);
  7   | }
  8   | 
  9   | test.describe("3A: Dashboard Stat Card Stagger", () => {
  10  |   test("3.1: Cards reach opacity 1", async ({ page }) => {
  11  |     await devLogin(page, "/dashboard");
  12  | 
> 13  |     await page.waitForFunction(
      |                ^ Error: page.waitForFunction: Test timeout of 60000ms exceeded.
  14  |       () => {
  15  |         const cards = document.querySelectorAll(".stat");
  16  |         if (cards.length === 0) return false;
  17  |         return Array.from(cards).every(
  18  |           (card) => getComputedStyle(card).opacity >= "0.99"
  19  |         );
  20  |       },
  21  |       { timeout: 5000 }
  22  |     );
  23  | 
  24  |     const cards = page.locator(".stat");
  25  |     const count = await cards.count();
  26  |     expect(count).toBeGreaterThan(0);
  27  |   });
  28  | 
  29  |   test("3.2: No layout shift during animation", async ({ page }) => {
  30  |     await devLogin(page, "/dashboard");
  31  | 
  32  |     // Measure bounding rects immediately
  33  |     const initialRects = await page.evaluate(() => {
  34  |       const cards = document.querySelectorAll(".stat");
  35  |       return Array.from(cards).map((card) => {
  36  |         const rect = card.getBoundingClientRect();
  37  |         return { left: rect.left, top: rect.top, width: rect.width };
  38  |       });
  39  |     });
  40  | 
  41  |     // Wait 2 seconds for animations to complete
  42  |     await page.waitForTimeout(2000);
  43  | 
  44  |     const finalRects = await page.evaluate(() => {
  45  |       const cards = document.querySelectorAll(".stat");
  46  |       return Array.from(cards).map((card) => {
  47  |         const rect = card.getBoundingClientRect();
  48  |         return { left: rect.left, top: rect.top, width: rect.width };
  49  |       });
  50  |     });
  51  | 
  52  |     expect(initialRects.length).toBeGreaterThan(0);
  53  | 
  54  |     for (let i = 0; i < initialRects.length; i++) {
  55  |       // No horizontal shift
  56  |       expect(Math.abs(finalRects[i].left - initialRects[i].left)).toBeLessThanOrEqual(1);
  57  |       // Vertical shift should be at most 12px (the y-distance from gsap.from)
  58  |       expect(Math.abs(finalRects[i].top - initialRects[i].top)).toBeLessThanOrEqual(12);
  59  |     }
  60  |   });
  61  | 
  62  |   test("3.3: Cards visible after reload", async ({ page }) => {
  63  |     await devLogin(page, "/dashboard");
  64  | 
  65  |     // Wait for initial animations
  66  |     await page.waitForTimeout(1000);
  67  | 
  68  |     // Hard refresh
  69  |     await page.reload();
  70  |     await page.waitForLoadState("networkidle");
  71  |     await page.waitForTimeout(2000);
  72  | 
  73  |     await page.waitForFunction(
  74  |       () => {
  75  |         const cards = document.querySelectorAll(".stat");
  76  |         if (cards.length === 0) return false;
  77  |         return Array.from(cards).every(
  78  |           (card) => parseFloat(getComputedStyle(card).opacity) >= 0.99
  79  |         );
  80  |       },
  81  |       { timeout: 5000 }
  82  |     );
  83  |   });
  84  | });
  85  | 
  86  | test.describe("3B: Members Grid Stagger", () => {
  87  |   test("3.4: Member cards reach opacity 1", async ({ page }) => {
  88  |     await devLogin(page, "/members");
  89  | 
  90  |     await page.waitForFunction(
  91  |       () => {
  92  |         // Find the members grid container and check its direct children
  93  |         const grids = document.querySelectorAll("[data-ref='membersGridRef'], .members-grid");
  94  |         // Fallback: look for any grid containing member cards
  95  |         let cards: Element[] = [];
  96  |         if (grids.length > 0) {
  97  |           cards = Array.from(grids[0].children);
  98  |         } else {
  99  |           // Try broader selector - the grid div containing MemberExpandableCard components
  100 |           const allGrids = document.querySelectorAll(".grid");
  101 |           for (const grid of allGrids) {
  102 |             if (grid.children.length > 2) {
  103 |               cards = Array.from(grid.children);
  104 |               break;
  105 |             }
  106 |           }
  107 |         }
  108 |         if (cards.length === 0) return false;
  109 |         return cards.every(
  110 |           (card) => parseFloat(getComputedStyle(card).opacity) >= 0.99
  111 |         );
  112 |       },
  113 |       { timeout: 5000 }
```