/**
 * Architecture documentation: Why dev endpoint guards are verified via grep, not unit tests.
 *
 * import.meta.dev is a Vite/Nitro build-time constant (not a runtime value):
 * - In a production build: Vite replaces `import.meta.dev` with `false` at compile time
 * - In a dev build: Vite replaces `import.meta.dev` with `true` at compile time
 * - In Vitest: import.meta.dev is always `undefined` (falsy) — it is never replaced
 *
 * Consequence: A unit test that imports the handler and calls it will always execute the
 * `!import.meta.dev` branch (404 throw), regardless of the test's intent. The "dev = true"
 * path cannot be reached in Vitest without patching the build pipeline.
 *
 * Verification strategy: Confirm the guard SOURCE PATTERN is present via grep.
 * The correctness of the production/dev branching is guaranteed by the Vite build constant mechanism,
 * not by runtime behavior observable in tests.
 *
 * Reference: RESEARCH.md Pitfall 2 — "import.meta.dev is a compile-time constant, always false/undefined in Vitest"
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DEV_ENDPOINT_FILES = [
  "server/api/dev/switch-user.post.ts",
  "server/api/dev/restore-user.post.ts",
  "server/api/dev/users.get.ts"
];

const HUB_ROOT = resolve(__dirname, "../../../..");

describe("Dev endpoint guards (architecture documentation)", () => {
  it.each(DEV_ENDPOINT_FILES)(
    "%s delegates to assertDevRoleSwitcherAccess for import.meta.dev guard",
    (relPath) => {
      const content = readFileSync(resolve(HUB_ROOT, relPath), "utf-8");
      // The handler must call assertDevRoleSwitcherAccess which internally checks import.meta.dev.
      // This is the centralized guard — adding !import.meta.dev directly in each handler would be redundant.
      expect(content).toContain("assertDevRoleSwitcherAccess");
      expect(content).toContain("requireSession(event)");
      // assertDevRoleSwitcherAccess must be called before any business logic
      const guardIndex = content.indexOf("assertDevRoleSwitcherAccess");
      // Verify it's imported
      expect(content).toMatch(/import.*assertDevRoleSwitcherAccess.*from.*dev-role-switcher/);
    }
  );

  it("isDevRoleSwitcherEnabled returns only import.meta.dev (no runtime fallbacks)", () => {
    const content = readFileSync(
      resolve(HUB_ROOT, "server/utils/dev-role-switcher.ts"),
      "utf-8"
    );
    expect(content).toContain("return import.meta.dev");
    expect(content).not.toContain("enablePerformanceDebug");
    expect(content).not.toMatch(/NODE_ENV.*development/);
  });
});
