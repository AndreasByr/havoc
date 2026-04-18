# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: motion-scroll.spec.ts >> Phase 7 – Scroll-triggered animations >> 7.4 No orphaned triggers on page leave
- Location: tests/motion-scroll.spec.ts:118:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('a[href="/dashboard"], a[href*="/dashboard"]').first()

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
  34  |         (el) => window.getComputedStyle(el).opacity
  35  |       );
  36  |       expect(Number(opacity)).toBe(1);
  37  |     }
  38  |   });
  39  | 
  40  |   test("7.2 Below-fold members wait for scroll", async ({ page }) => {
  41  |     await devLogin(page, "/members");
  42  | 
  43  |     await page.waitForTimeout(2000);
  44  | 
  45  |     const viewportHeight = page.viewportSize()?.height ?? 800;
  46  |     const memberCards = page.locator(".grid.gap-6 > *");
  47  |     const count = await memberCards.count();
  48  | 
  49  |     // Find the first card below the fold
  50  |     let belowFoldIndex = -1;
  51  |     for (let i = 0; i < count; i++) {
  52  |       const box = await memberCards.nth(i).boundingBox();
  53  |       if (box && box.y >= viewportHeight) {
  54  |         belowFoldIndex = i;
  55  |         break;
  56  |       }
  57  |     }
  58  | 
  59  |     if (belowFoldIndex === -1) {
  60  |       test.skip(true, "All member cards fit in viewport — no below-fold cards");
  61  |       return;
  62  |     }
  63  | 
  64  |     // Below-fold cards should not be animated yet
  65  |     const opacityBefore = await memberCards.nth(belowFoldIndex).evaluate(
  66  |       (el) => window.getComputedStyle(el).opacity
  67  |     );
  68  |     expect(Number(opacityBefore)).toBeLessThan(1);
  69  | 
  70  |     // Scroll the below-fold card into view
  71  |     await memberCards.nth(belowFoldIndex).scrollIntoViewIfNeeded();
  72  |     await page.waitForTimeout(1500);
  73  | 
  74  |     // Now it should be animated
  75  |     const opacityAfter = await memberCards.nth(belowFoldIndex).evaluate(
  76  |       (el) => window.getComputedStyle(el).opacity
  77  |     );
  78  |     expect(Number(opacityAfter)).toBe(1);
  79  |   });
  80  | 
  81  |   test("7.3 ScrollTrigger.refresh() fires after page transition", async ({
  82  |     page,
  83  |   }) => {
  84  |     await devLogin(page, "/dashboard");
  85  | 
  86  |     // Navigate to /members via sidebar link (client-side navigation)
  87  |     const membersLink = page.locator(
  88  |       'a[href="/members"], a[href*="/members"]'
  89  |     ).first();
  90  |     await membersLink.click();
  91  | 
  92  |     await page.waitForURL("**/members**");
  93  |     await page.waitForLoadState("networkidle");
  94  |     await page.waitForTimeout(2500);
  95  | 
  96  |     // After page transition with ScrollTrigger.refresh(), cards should animate
  97  |     const memberCards = page.locator(".grid.gap-6 > *");
  98  |     const count = await memberCards.count();
  99  | 
  100 |     if (count === 0) {
  101 |       test.skip(true, "No member cards found after navigation");
  102 |       return;
  103 |     }
  104 | 
  105 |     const viewportHeight = page.viewportSize()?.height ?? 800;
  106 | 
  107 |     for (let i = 0; i < count; i++) {
  108 |       const box = await memberCards.nth(i).boundingBox();
  109 |       if (!box || box.y >= viewportHeight) break;
  110 | 
  111 |       const opacity = await memberCards.nth(i).evaluate(
  112 |         (el) => window.getComputedStyle(el).opacity
  113 |       );
  114 |       expect(Number(opacity)).toBe(1);
  115 |     }
  116 |   });
  117 | 
  118 |   test("7.4 No orphaned triggers on page leave", async ({ page }) => {
  119 |     const consoleMessages: string[] = [];
  120 | 
  121 |     page.on("console", (msg) => {
  122 |       if (msg.type() === "warning" || msg.type() === "error") {
  123 |         consoleMessages.push(msg.text());
  124 |       }
  125 |     });
  126 | 
  127 |     await devLogin(page, "/members");
  128 |     await page.waitForTimeout(2000);
  129 | 
  130 |     // Navigate away to dashboard
  131 |     const dashboardLink = page.locator(
  132 |       'a[href="/dashboard"], a[href*="/dashboard"]'
  133 |     ).first();
> 134 |     await dashboardLink.click();
      |                         ^ Error: locator.click: Test timeout of 60000ms exceeded.
  135 | 
  136 |     await page.waitForURL("**/dashboard**");
  137 |     await page.waitForLoadState("networkidle");
  138 |     await page.waitForTimeout(1500);
  139 | 
  140 |     // Check for ScrollTrigger-related warnings
  141 |     const scrollTriggerWarnings = consoleMessages.filter(
  142 |       (msg) =>
  143 |         msg.toLowerCase().includes("scrolltrigger") &&
  144 |         (msg.toLowerCase().includes("orphan") ||
  145 |           msg.toLowerCase().includes("leak") ||
  146 |           msg.toLowerCase().includes("killed") ||
  147 |           msg.toLowerCase().includes("not found"))
  148 |     );
  149 | 
  150 |     expect(scrollTriggerWarnings).toHaveLength(0);
  151 |   });
  152 | });
  153 | 
```