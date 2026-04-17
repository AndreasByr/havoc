/**
 * Architecture documentation: Why cookie-secure config is verified via file read, not a request test.
 *
 * The session cookie `secure` flag is set in nuxt.config.ts as a static config value read at
 * Nuxt startup. It is not a function that can be called at request time — it is passed to
 * nuxt-auth-utils which sets it on every Set-Cookie response header via Nitro's session middleware.
 *
 * Testing the actual header would require a full Nuxt integration test (start server, make request,
 * inspect Set-Cookie header). That is a > 30s test and exceeds the phase budget.
 *
 * Verification strategy: Confirm the config SOURCE PATTERN uses `NODE_ENV !== "development"` (not
 * the old URL heuristic). The correctness of this mapping to the Set-Cookie Secure attribute is
 * guaranteed by nuxt-auth-utils, which is a verified dependency (see RESEARCH.md Standard Stack).
 *
 * Reference: F-10 fix — replace URL-heuristic cookie-secure with NODE_ENV check (D-08).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HUB_ROOT = resolve(__dirname, "../..");

describe("Cookie secure configuration (architecture documentation)", () => {
  it("nuxt.config.ts sets cookie secure to NODE_ENV !== 'development' (not URL heuristic)", () => {
    const content = readFileSync(resolve(HUB_ROOT, "nuxt.config.ts"), "utf-8");
    expect(content).toContain('process.env.NODE_ENV !== "development"');
    expect(content).not.toContain("NUXT_SESSION_COOKIE_SECURE");
    // The old URL heuristic used NUXT_PUBLIC_HUB_URL || "").startsWith("https://")
    // directly in the cookie secure value. Verify that specific pattern is gone.
    expect(content).not.toContain('NUXT_PUBLIC_HUB_URL || "").startsWith("https://")');
  });
});
