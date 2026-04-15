import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "apps/bot/vitest.config.ts",
  "apps/hub/vitest.config.ts",
  "apps/matrix-bot/vitest.config.ts",
  "packages/shared/vitest.config.ts",
]);
