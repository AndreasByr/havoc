import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./apps/bot/vitest.config.ts",
    test: { name: "bot" }
  },
  {
    extends: "./apps/hub/vitest.config.ts",
    test: { name: "hub" }
  },
  {
    extends: "./apps/matrix-bot/vitest.config.ts",
    test: { name: "matrix-bot" }
  },
  {
    extends: "./packages/shared/vitest.config.ts",
    test: { name: "shared" }
  }
]);
