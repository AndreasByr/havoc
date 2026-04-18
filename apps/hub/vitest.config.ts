import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";

// Resolve h3 from pnpm's .pnpm directory since it's not hoisted
function resolveH3(): string {
  const pnpmDir = resolve(__dirname, "../../node_modules/.pnpm");
  const h3Dir = readdirSync(pnpmDir).find((d) => d.startsWith("h3@1"));
  if (h3Dir) {
    return resolve(pnpmDir, h3Dir, "node_modules/h3/dist/index.mjs");
  }
  return "h3";
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.spec.ts", "**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.nuxt/**", "**/.output/**", "**/dist/**", "tests/**"]
  },
  // Disable esbuild (deprecated in vite 8) — oxc handles TS transform by default.
  // tsconfigRaw '{}' is no longer needed since .nuxt/tsconfig.json provides the config.
  esbuild: false,
  resolve: {
    alias: {
      h3: resolveH3()
    }
  }
});
